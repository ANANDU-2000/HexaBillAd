#!/usr/bin/env python3
"""Read-only structural and integrity validator for the private Starplus JSON archive.

The validator never connects to a database or mutates source data. Reports can
contain source IDs and must be written only to an access-controlled private
location (for example data/starplus_private/).
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import sys
from typing import Any


class ArchiveValidationError(Exception):
    pass


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _validate_private_report_path(report_path: Path) -> Path:
    resolved = report_path.resolve()
    if resolved.exists():
        raise ArchiveValidationError("Refusing to overwrite an existing report")
    try:
        resolved.relative_to(REPOSITORY_ROOT)
    except ValueError:
        return resolved
    allowed_roots = (
        (REPOSITORY_ROOT / "data" / "starplus_private").resolve(),
        (REPOSITORY_ROOT / "frozhen").resolve(),
    )
    if not any(resolved == root or root in resolved.parents for root in allowed_roots):
        raise ArchiveValidationError(
            "Report path is inside the repository but outside ignored private migration directories"
        )
    return resolved


def _canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _identifier(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    value = str(value).strip()
    return value or None


def _decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise InvalidOperation
    result = Decimal(str(value))
    if not result.is_finite():
        raise InvalidOperation
    return result


def _valid_date(value: Any) -> bool:
    if value is None or value == "":
        return True
    if not isinstance(value, str):
        return False
    try:
        if "T" in value or " " in value:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            date.fromisoformat(value)
        return True
    except ValueError:
        return False


def _append_issue(issues: list[dict[str, Any]], code: str, **details: Any) -> None:
    issues.append({"code": code, **details})


def validate_archive(
    archive_path: Path, invoice_csv_path: Path | None = None
) -> dict[str, Any]:
    raw = archive_path.read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    try:
        data = json.loads(raw.decode("utf-8"), parse_float=Decimal)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ArchiveValidationError(f"Invalid UTF-8 JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ArchiveValidationError("Archive root must be a JSON object")
    for name in ("customers", "products", "unattributed_invoices"):
        if not isinstance(data.get(name), list):
            raise ArchiveValidationError(f"Archive field {name!r} must be an array")

    customers = data["customers"]
    products = data["products"]
    unattributed = data["unattributed_invoices"]
    issues: list[dict[str, Any]] = []
    customer_by_id: dict[str, dict[str, Any]] = {}
    product_by_id: dict[str, dict[str, Any]] = {}

    for index, customer in enumerate(customers):
        if not isinstance(customer, dict):
            _append_issue(issues, "INVALID_CUSTOMER_ROW", row=index)
            continue
        source_id = _identifier(customer.get("source_customer_id"))
        if source_id is None:
            _append_issue(issues, "MISSING_CUSTOMER_ID", row=index)
        elif source_id in customer_by_id:
            _append_issue(issues, "DUPLICATE_CUSTOMER_ID", source_customer_id=source_id)
        else:
            customer_by_id[source_id] = customer
        if not isinstance(customer.get("invoices", []), list):
            _append_issue(issues, "INVALID_CUSTOMER_INVOICES", source_customer_id=source_id)

    for index, product in enumerate(products):
        if not isinstance(product, dict):
            _append_issue(issues, "INVALID_PRODUCT_ROW", row=index)
            continue
        source_id = _identifier(product.get("source_product_id"))
        if source_id is None:
            _append_issue(issues, "MISSING_PRODUCT_ID", row=index)
        elif source_id in product_by_id:
            _append_issue(issues, "DUPLICATE_PRODUCT_ID", source_product_id=source_id)
        else:
            product_by_id[source_id] = product

    invoice_by_id: dict[str, dict[str, Any]] = {}
    invoice_customer_ids: dict[str, str | None] = {}
    invoice_numbers: dict[str, list[str]] = {}
    item_ids: set[str] = set()
    payment_ids: set[str] = set()
    item_count = 0
    payment_count = 0
    no_item_ids: list[str] = []
    active_no_item_ids: list[str] = []
    deleted_count = 0
    active_count = 0
    payment_statuses: dict[str, int] = {}
    decimal_errors: list[dict[str, Any]] = []
    invalid_dates: list[dict[str, Any]] = []
    unknown_product_item_count = 0
    line_sum_difference_count = 0
    line_sum_absolute_difference = Decimal("0")
    line_sum_differences: list[dict[str, Any]] = []
    decimal_fields = {
        "invoice": ("subtotal", "discount", "vat_total", "round_off", "grand_total", "total_amount", "paid_amount", "outstanding_calculated"),
        "item": ("quantity", "unit_price", "discount", "vat_amount", "line_total"),
        "payment": ("amount",),
        "product": ("cost_price", "sell_price", "stock_qty_legacy", "conversion_to_base"),
    }

    def check_decimals(record: dict[str, Any], kind: str, record_id: str | None) -> None:
        for field in decimal_fields[kind]:
            if field not in record or record[field] is None or record[field] == "":
                continue
            try:
                _decimal(record[field])
            except (InvalidOperation, ValueError, TypeError):
                decimal_errors.append({"kind": kind, "source_id": record_id, "field": field})

    def check_date(record: dict[str, Any], field: str, kind: str, record_id: str | None) -> None:
        if field in record and not _valid_date(record[field]):
            invalid_dates.append({"kind": kind, "source_id": record_id, "field": field})

    def collect_invoice(invoice: Any, containing_customer: str | None, unattributed_row: bool) -> None:
        nonlocal item_count, payment_count, deleted_count, active_count
        nonlocal unknown_product_item_count, line_sum_difference_count, line_sum_absolute_difference
        if not isinstance(invoice, dict):
            _append_issue(issues, "INVALID_INVOICE_ROW")
            return
        invoice_id = _identifier(invoice.get("source_invoice_id"))
        if invoice_id is None:
            _append_issue(issues, "MISSING_INVOICE_ID")
            return
        if invoice_id in invoice_by_id:
            _append_issue(issues, "DUPLICATE_INVOICE_ID", source_invoice_id=invoice_id)
            return
        invoice_by_id[invoice_id] = invoice
        referenced_customer = _identifier(invoice.get("source_customer_id"))
        invoice_customer_ids[invoice_id] = referenced_customer
        if containing_customer is not None and referenced_customer != containing_customer:
            _append_issue(issues, "INVOICE_CUSTOMER_MISMATCH", source_invoice_id=invoice_id)
        if referenced_customer is not None and referenced_customer not in customer_by_id:
            _append_issue(issues, "UNKNOWN_CUSTOMER_REFERENCE", source_invoice_id=invoice_id)
        if unattributed_row or referenced_customer is None:
            _append_issue(issues, "UNATTRIBUTED_INVOICE", source_invoice_id=invoice_id)

        invoice_number = _identifier(invoice.get("legacy_invoice_number"))
        if invoice_number:
            invoice_numbers.setdefault(invoice_number, []).append(invoice_id)

        is_deleted = invoice.get("is_deleted")
        if not isinstance(is_deleted, bool):
            _append_issue(issues, "INVALID_DELETED_FLAG", source_invoice_id=invoice_id)
        elif is_deleted:
            deleted_count += 1
        else:
            active_count += 1

        check_decimals(invoice, "invoice", invoice_id)
        check_date(invoice, "invoice_date", "invoice", invoice_id)
        check_date(invoice, "due_date", "invoice", invoice_id)

        line_sum = Decimal("0")
        raw_items = invoice.get("items", [])
        if not isinstance(raw_items, list):
            _append_issue(issues, "INVALID_INVOICE_ITEMS", source_invoice_id=invoice_id)
            raw_items = []
        if not raw_items:
            no_item_ids.append(invoice_id)
            if is_deleted is False:
                active_no_item_ids.append(invoice_id)
            _append_issue(issues, "INVOICE_WITHOUT_ITEMS", source_invoice_id=invoice_id)
        for item in raw_items:
            if not isinstance(item, dict):
                _append_issue(issues, "INVALID_INVOICE_ITEM", source_invoice_id=invoice_id)
                continue
            item_count += 1
            item_id = _identifier(item.get("source_item_id"))
            if item_id is None:
                _append_issue(issues, "MISSING_INVOICE_ITEM_ID", source_invoice_id=invoice_id)
            elif item_id in item_ids:
                _append_issue(issues, "DUPLICATE_INVOICE_ITEM_ID", source_item_id=item_id)
            else:
                item_ids.add(item_id)
            check_decimals(item, "item", item_id)
            product_id = _identifier(item.get("source_product_id"))
            if product_id is not None and product_id not in product_by_id:
                unknown_product_item_count += 1
                _append_issue(issues, "UNKNOWN_PRODUCT_REFERENCE", source_invoice_id=invoice_id, source_item_id=item_id)
            try:
                line_sum += _decimal(item.get("line_total")) or Decimal("0")
            except (InvalidOperation, ValueError, TypeError):
                pass

        try:
            invoice_total = _decimal(invoice.get("grand_total", invoice.get("total_amount")))
            if raw_items and invoice_total is not None and abs(line_sum - invoice_total) > Decimal("0.01"):
                line_sum_difference_count += 1
                line_sum_absolute_difference += abs(line_sum - invoice_total)
                line_sum_differences.append({
                    "source_invoice_id": invoice_id,
                    "line_sum": str(line_sum),
                    "grand_total": str(invoice_total),
                    "difference": str(line_sum - invoice_total),
                })
        except (InvalidOperation, ValueError, TypeError):
            pass

        raw_payments = invoice.get("payments", [])
        if not isinstance(raw_payments, list):
            _append_issue(issues, "INVALID_INVOICE_PAYMENTS", source_invoice_id=invoice_id)
            raw_payments = []
        for payment in raw_payments:
            if not isinstance(payment, dict):
                _append_issue(issues, "INVALID_PAYMENT_ROW", source_invoice_id=invoice_id)
                continue
            payment_count += 1
            payment_id = _identifier(payment.get("source_payment_id"))
            if payment_id is None:
                _append_issue(issues, "MISSING_PAYMENT_ID", source_invoice_id=invoice_id)
            elif payment_id in payment_ids:
                _append_issue(issues, "DUPLICATE_PAYMENT_ID", source_payment_id=payment_id)
            else:
                payment_ids.add(payment_id)
            status = _identifier(payment.get("status")) or "<MISSING>"
            payment_statuses[status] = payment_statuses.get(status, 0) + 1
            check_decimals(payment, "payment", payment_id)
            check_date(payment, "payment_date", "payment", payment_id)

    for customer_id, customer in customer_by_id.items():
        invoices = customer.get("invoices", [])
        if isinstance(invoices, list):
            for invoice in invoices:
                collect_invoice(invoice, customer_id, False)
    for invoice in unattributed:
        collect_invoice(invoice, None, True)
    for product_id, product in product_by_id.items():
        check_decimals(product, "product", product_id)

    duplicate_active_invoice_numbers = 0
    for number, ids in invoice_numbers.items():
        active_ids = [invoice_id for invoice_id in ids if invoice_by_id[invoice_id].get("is_deleted") is False]
        if len(active_ids) > 1:
            duplicate_active_invoice_numbers += 1
            for invoice_id in active_ids:
                _append_issue(issues, "DUPLICATE_ACTIVE_INVOICE_NUMBER", source_invoice_id=invoice_id)

    reported = data.get("summary", {}) if isinstance(data.get("summary"), dict) else {}
    reported_quality = data.get("data_quality", {}) if isinstance(data.get("data_quality"), dict) else {}
    actual_counts = {
        "customers": len(customer_by_id),
        "products": len(product_by_id),
        "invoices": len(invoice_by_id),
        "active_invoices": active_count,
        "deleted_invoices": deleted_count,
        "invoice_items": item_count,
        "payments": payment_count,
    }
    summary_fields = {
        "customers": "customers",
        "products": "products",
        "invoices": "invoices_total",
        "active_invoices": "invoices_active",
        "deleted_invoices": "invoices_deleted",
        "invoice_items": "sale_line_items",
        "payments": "payments",
    }
    summary_mismatches = []
    for actual_key, source_key in summary_fields.items():
        if source_key in reported and reported[source_key] != actual_counts[actual_key]:
            summary_mismatches.append({"field": source_key, "reported": reported[source_key], "actual": actual_counts[actual_key]})
    reported_line_difference_count = reported_quality.get("line_item_total_difference_count")
    line_difference_definition_mismatch = (
        isinstance(reported_line_difference_count, int)
        and reported_line_difference_count != line_sum_difference_count
    )

    invoice_csv = None
    if invoice_csv_path is not None:
        csv_ids: list[str] = []
        with invoice_csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames or "source_invoice_id" not in reader.fieldnames:
                raise ArchiveValidationError("Invoice reconciliation CSV is missing source_invoice_id")
            for row in reader:
                csv_id = _identifier(row.get("source_invoice_id"))
                if csv_id is not None:
                    csv_ids.append(csv_id)
        csv_id_set = set(csv_ids)
        archive_id_set = set(invoice_by_id)
        invoice_csv = {
            "rows": len(csv_ids),
            "unique_ids": len(csv_id_set),
            "archive_ids_missing_from_csv": len(archive_id_set - csv_id_set),
            "csv_ids_missing_from_archive": len(csv_id_set - archive_id_set),
            "duplicate_csv_ids": len(csv_ids) - len(csv_id_set),
        }

    for issue in decimal_errors:
        _append_issue(issues, "INVALID_DECIMAL", **issue)
    for issue in invalid_dates:
        _append_issue(issues, "INVALID_DATE", **issue)
    for mismatch in summary_mismatches:
        _append_issue(issues, "SUMMARY_COUNT_MISMATCH", **mismatch)
    if line_difference_definition_mismatch:
        _append_issue(
            issues,
            "LINE_DIFFERENCE_COUNT_METHOD_MISMATCH",
            archive_reported_count=reported_line_difference_count,
            recomputed_count=line_sum_difference_count,
            recomputed_method="sum(item.line_total) vs invoice.grand_total, absolute difference > 0.01",
        )
    for mismatch in line_sum_differences:
        _append_issue(issues, "LINE_SUM_GRAND_TOTAL_DIFFERENCE", **mismatch)

    issue_counts: dict[str, int] = {}
    for issue in issues:
        issue_counts[issue["code"]] = issue_counts.get(issue["code"], 0) + 1

    return {
        "status": "PASS_WITH_REVIEW" if issues else "PASS",
        "read_only": True,
        "source_file": archive_path.name,
        "source_sha256": source_hash,
        "record_counts": actual_counts,
        "summary_count_mismatches": summary_mismatches,
        "invoice_reconciliation_csv": invoice_csv,
        "quality": {
            "unattributed_invoices": issue_counts.get("UNATTRIBUTED_INVOICE", 0),
            "invoices_without_items": len(no_item_ids),
            "active_invoices_without_items": len(active_no_item_ids),
            "unknown_product_references": unknown_product_item_count,
            "duplicate_active_invoice_numbers": duplicate_active_invoice_numbers,
            "line_sum_vs_grand_total_over_one_cent": line_sum_difference_count,
            "archive_reported_line_difference_count": reported_line_difference_count,
            "line_difference_count_method_mismatch": line_difference_definition_mismatch,
            "line_sum_absolute_difference": str(line_sum_absolute_difference),
            "payment_status_counts": dict(sorted(payment_statuses.items())),
            "invalid_decimal_values": len(decimal_errors),
            "invalid_dates": len(invalid_dates),
            "issue_counts": dict(sorted(issue_counts.items())),
        },
        "record_hashes": {
            "customers": {key: _canonical_hash(value) for key, value in sorted(customer_by_id.items())},
            "products": {key: _canonical_hash(value) for key, value in sorted(product_by_id.items())},
            "invoices": {key: _canonical_hash(value) for key, value in sorted(invoice_by_id.items())},
        },
        "issues": issues,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="private staging JSON archive")
    parser.add_argument("--invoice-csv", type=Path, help="optional invoice reconciliation CSV")
    parser.add_argument("--report", type=Path, help="write full report to a private path")
    args = parser.parse_args(argv)
    try:
        report = validate_archive(args.archive, args.invoice_csv)
    except (OSError, ArchiveValidationError) as exc:
        print(f"validation failed: {exc}", file=sys.stderr)
        return 2
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        try:
            report_path = _validate_private_report_path(args.report)
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(rendered + "\n", encoding="utf-8")
        except (OSError, ArchiveValidationError) as exc:
            print(f"report not written: {exc}", file=sys.stderr)
            return 2
    summary_quality = {
        key: value for key, value in report["quality"].items()
        if key not in {"line_sum_absolute_difference"}
    }
    print(json.dumps({
        "status": report["status"],
        "source_sha256": report["source_sha256"],
        "record_counts": report["record_counts"],
        "quality": summary_quality,
        "invoice_reconciliation_csv": report["invoice_reconciliation_csv"],
        "report_written": bool(args.report),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
