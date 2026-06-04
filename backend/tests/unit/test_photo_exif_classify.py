"""Tests for Lane 7 — photo EXIF GPS extraction and defect-category heuristic.

Covers:
- ``extract_exif_gps``: real EXIF GPS parsing from a hand-built TIFF/EXIF
  block (bare TIFF and JPEG-APP1-wrapped), hemisphere refs, null-island and
  out-of-range rejection, and graceful None on garbage input.
- ``heuristic_photo_category`` / ``_coerce_suggested_category``: the
  deterministic, AI-free fallback used when no provider key is configured.

These exercise pure functions only — no DB, no network, no AI provider.
"""

from __future__ import annotations

import struct

from app.core.match_service.extractors.photo import extract_exif_gps
from app.modules.ai.service import (
    PHOTO_CATEGORIES,
    _coerce_suggested_category,
    heuristic_photo_category,
)

# ── EXIF builders (little-endian "II" TIFF) ───────────────────────────────


def _rational(num: int, den: int) -> bytes:
    return struct.pack("<II", num, den)


def _build_tiff_with_gps(
    *,
    lat_dms: tuple[int, int, int],
    lon_dms: tuple[int, int, int],
    lat_ref: bytes = b"N",
    lon_ref: bytes = b"E",
) -> bytes:
    """Build a minimal little-endian TIFF/EXIF block with a GPS IFD.

    Layout:
        [0:8]   TIFF header (II, 0x002A, IFD0 offset = 8)
        [8:..]  IFD0: 1 entry -> GPSInfo (0x8825) pointing at the GPS IFD
        [..]    GPS IFD: 4 entries (lat ref, lat, lon ref, lon)
        [..]    value heap: the 3 rationals for lat and the 3 for lon
    """
    byte_order = b"II"
    header = byte_order + struct.pack("<H", 0x2A) + struct.pack("<I", 8)

    # IFD0 sits at offset 8: count(2) + one 12-byte entry + next-IFD ptr(4) = 18
    ifd0_count = struct.pack("<H", 1)
    gps_ifd_offset = 8 + 2 + 12 + 4  # = 26
    # GPSInfo tag, type LONG(4), count 1, value = offset of GPS IFD
    ifd0_entry = struct.pack("<HHI", 0x8825, 4, 1) + struct.pack("<I", gps_ifd_offset)
    ifd0_next = struct.pack("<I", 0)
    ifd0 = ifd0_count + ifd0_entry + ifd0_next

    # GPS IFD at offset 26: count(2) + 4*12 entries + next(4) = 54 bytes
    gps_count = struct.pack("<H", 4)
    # Value heap starts after the GPS IFD block.
    heap_offset = gps_ifd_offset + 2 + 4 * 12 + 4
    lat_offset = heap_offset
    lon_offset = heap_offset + 24  # 3 rationals = 24 bytes

    # Refs are ASCII, 2 chars ("N\0") -> fits inline in the 4-byte value field.
    lat_ref_entry = struct.pack("<HHI", 0x0001, 2, 2) + (lat_ref + b"\x00").ljust(4, b"\x00")
    lat_entry = struct.pack("<HHI", 0x0002, 5, 3) + struct.pack("<I", lat_offset)
    lon_ref_entry = struct.pack("<HHI", 0x0003, 2, 2) + (lon_ref + b"\x00").ljust(4, b"\x00")
    lon_entry = struct.pack("<HHI", 0x0004, 5, 3) + struct.pack("<I", lon_offset)
    gps_next = struct.pack("<I", 0)
    gps_ifd = gps_count + lat_ref_entry + lat_entry + lon_ref_entry + lon_entry + gps_next

    lat_vals = _rational(lat_dms[0], 1) + _rational(lat_dms[1], 1) + _rational(lat_dms[2], 1)
    lon_vals = _rational(lon_dms[0], 1) + _rational(lon_dms[1], 1) + _rational(lon_dms[2], 1)

    return header + ifd0 + gps_ifd + lat_vals + lon_vals


def _wrap_in_jpeg(tiff: bytes) -> bytes:
    """Wrap a TIFF/EXIF block in a minimal JPEG APP1 segment."""
    exif_payload = b"Exif\x00\x00" + tiff
    seg_len = len(exif_payload) + 2
    app1 = b"\xff\xe1" + struct.pack(">H", seg_len) + exif_payload
    # SOI + APP1 + EOI is enough for our marker walker.
    return b"\xff\xd8" + app1 + b"\xff\xd9"


# ── extract_exif_gps ──────────────────────────────────────────────────────


class TestExtractExifGps:
    def test_bare_tiff_north_east(self):
        tiff = _build_tiff_with_gps(lat_dms=(52, 30, 0), lon_dms=(13, 24, 0))
        coords = extract_exif_gps(tiff)
        assert coords is not None
        lat, lon = coords
        assert abs(lat - 52.5) < 1e-4
        assert abs(lon - 13.4) < 1e-4

    def test_jpeg_wrapped(self):
        tiff = _build_tiff_with_gps(lat_dms=(48, 0, 0), lon_dms=(11, 0, 0))
        jpeg = _wrap_in_jpeg(tiff)
        coords = extract_exif_gps(jpeg)
        assert coords is not None
        lat, lon = coords
        assert abs(lat - 48.0) < 1e-4
        assert abs(lon - 11.0) < 1e-4

    def test_southern_western_hemisphere_negative(self):
        tiff = _build_tiff_with_gps(
            lat_dms=(33, 51, 0),
            lon_dms=(70, 39, 0),
            lat_ref=b"S",
            lon_ref=b"W",
        )
        coords = extract_exif_gps(tiff)
        assert coords is not None
        lat, lon = coords
        assert lat < 0
        assert lon < 0
        assert abs(lat - (-33.85)) < 1e-4
        assert abs(lon - (-70.65)) < 1e-4

    def test_null_island_rejected(self):
        tiff = _build_tiff_with_gps(lat_dms=(0, 0, 0), lon_dms=(0, 0, 0))
        assert extract_exif_gps(tiff) is None

    def test_out_of_range_rejected(self):
        # 200 degrees longitude is impossible -> None, not a misplacement.
        tiff = _build_tiff_with_gps(lat_dms=(10, 0, 0), lon_dms=(200, 0, 0))
        assert extract_exif_gps(tiff) is None

    def test_garbage_returns_none(self):
        assert extract_exif_gps(b"not an image at all") is None
        assert extract_exif_gps(b"") is None
        assert extract_exif_gps(b"\xff\xd8\xff\xd9") is None  # JPEG with no EXIF

    def test_no_gps_ifd_returns_none(self):
        # A valid TIFF header with no IFD0 GPS pointer -> None.
        bare = b"II" + struct.pack("<H", 0x2A) + struct.pack("<I", 8)
        bare += struct.pack("<H", 0) + struct.pack("<I", 0)  # empty IFD0
        assert extract_exif_gps(bare) is None


# ── heuristic_photo_category ──────────────────────────────────────────────


class TestHeuristicPhotoCategory:
    def test_defect_keyword(self):
        result = heuristic_photo_category(filename="wall_crack_floor2.jpg")
        assert result is not None
        category, conf = result
        assert category == "defect"
        assert 0.0 < conf <= 1.0

    def test_safety_keyword_from_tags(self):
        result = heuristic_photo_category(filename="img1.jpg", tags=["scaffold", "ppe"])
        assert result is not None
        assert result[0] == "safety"

    def test_delivery_keyword_from_caption(self):
        result = heuristic_photo_category(caption="Rebar delivery unloaded today")
        assert result is not None
        assert result[0] == "delivery"

    def test_progress_keyword(self):
        result = heuristic_photo_category(filename="concrete_pour_slab.jpg")
        assert result is not None
        assert result[0] == "progress"

    def test_no_signal_returns_none(self):
        assert heuristic_photo_category(filename="IMG_0001.jpg") is None
        assert heuristic_photo_category() is None
        assert heuristic_photo_category(filename="", caption="", tags=[]) is None

    def test_returned_category_is_always_valid(self):
        for fn in ("crack.jpg", "ppe_helmet.jpg", "delivery.jpg", "pour.jpg", "site_overview.jpg"):
            result = heuristic_photo_category(filename=fn)
            assert result is not None
            assert result[0] in PHOTO_CATEGORIES


# ── _coerce_suggested_category ────────────────────────────────────────────


class TestCoerceSuggestedCategory:
    def test_valid_category_passthrough(self):
        assert _coerce_suggested_category("defect") == "defect"
        assert _coerce_suggested_category("  Safety ") == "safety"

    def test_invalid_category_rejected(self):
        assert _coerce_suggested_category("explosion") is None
        assert _coerce_suggested_category("") is None
        assert _coerce_suggested_category(None) is None
        assert _coerce_suggested_category(123) is None
