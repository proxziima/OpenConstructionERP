"""Supplier Catalogs event names.

All events are best-effort published via ``event_bus.publish_detached``
inside the service layer. Subscribers in notifications + finance can
consume these without coupling to the supplier_catalogs ORM.
"""

VENDOR_CREATED = "supplier_catalogs.vendor.created"
VENDOR_SUSPENDED = "supplier_catalogs.vendor.suspended"
VENDOR_BLACKLISTED = "supplier_catalogs.vendor.blacklisted"
VENDOR_RATED = "supplier_catalogs.vendor.rated"

PRICE_LIST_IMPORTED = "supplier_catalogs.price_list.imported"

PR_SUBMITTED = "supplier_catalogs.pr.submitted"
PR_APPROVED = "supplier_catalogs.pr.approved"
PR_REJECTED = "supplier_catalogs.pr.rejected"
PR_CONVERTED = "supplier_catalogs.pr.converted"

PO_CREATED = "supplier_catalogs.po.created"
PO_SENT = "supplier_catalogs.po.sent"
PO_ACKNOWLEDGED = "supplier_catalogs.po.acknowledged"
PO_RECEIVED = "supplier_catalogs.po.received"
PO_CLOSED = "supplier_catalogs.po.closed"

GR_POSTED = "supplier_catalogs.gr.posted"

INVOICE_MATCHED = "supplier_catalogs.invoice.matched"
INVOICE_EXCEPTION = "supplier_catalogs.invoice.exception"

STOCK_RESERVED = "supplier_catalogs.stock.reserved"
STOCK_ISSUED = "supplier_catalogs.stock.issued"
STOCK_LOW_THRESHOLD = "supplier_catalogs.stock.low_threshold"
STOCK_ADJUSTED = "supplier_catalogs.stock.adjusted"

# Stock low / reorder alert — emitted whenever a balance dips below reorder_point
STOCK_LOW = "supplier_catalogs.stock.low"

# KYC / compliance lifecycle
KYC_DOC_UPLOADED = "supplier_catalogs.kyc.uploaded"
KYC_DOC_EXPIRING = "supplier_catalogs.kyc.expiring"
KYC_DOC_EXPIRED = "supplier_catalogs.kyc.expired"

# Scorecard
SCORECARD_COMPUTED = "supplier_catalogs.scorecard.computed"

# PEPPOL ingest
PEPPOL_INVOICE_INGESTED = "supplier_catalogs.invoice.peppol_ingested"
