import json
from pathlib import Path
import tempfile
import unittest

from tools.migration.validate_starplus_archive import (
    ArchiveValidationError,
    REPOSITORY_ROOT,
    _validate_private_report_path,
    validate_archive,
)


class ValidateStarplusArchiveTests(unittest.TestCase):
    def make_archive(self, root: Path) -> Path:
        fixture = {
            "summary": {
                "customers": 1,
                "products": 1,
                "invoices_total": 1,
                "invoices_active": 1,
                "invoices_deleted": 0,
                "sale_line_items": 1,
                "payments": 1,
            },
            "customers": [{
                "source_customer_id": 7,
                "invoices": [{
                    "source_invoice_id": 70,
                    "source_customer_id": 7,
                    "legacy_invoice_number": "LEG-70",
                    "invoice_date": "2025-01-02T10:30:00",
                    "is_deleted": False,
                    "grand_total": "12.50",
                    "items": [{
                        "source_item_id": 700,
                        "source_product_id": 8,
                        "quantity": "2.5",
                        "unit_price": "5.00",
                        "line_total": "12.50",
                    }],
                    "payments": [{
                        "source_payment_id": 7000,
                        "status": "CLEARED",
                        "amount": "12.50",
                        "payment_date": "2025-01-03",
                    }],
                }],
            }],
            "products": [{"source_product_id": 8, "sell_price": "5.00"}],
            "unattributed_invoices": [],
        }
        path = root / "archive.json"
        path.write_text(json.dumps(fixture), encoding="utf-8")
        return path

    def test_validates_relationships_counts_dates_and_decimal_strings(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.make_archive(Path(temp))
            report = validate_archive(path)
        self.assertEqual("PASS", report["status"])
        self.assertEqual(1, report["record_counts"]["invoices"])
        self.assertEqual(1, report["record_counts"]["invoice_items"])
        self.assertEqual(1, report["record_counts"]["payments"])
        self.assertEqual(64, len(report["record_hashes"]["invoices"]["70"]))
        self.assertEqual(0, report["quality"]["invalid_decimal_values"])

    def test_reports_missing_items_and_unsettled_status_without_mutating_source(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.make_archive(Path(temp))
            fixture = json.loads(path.read_text(encoding="utf-8"))
            invoice = fixture["customers"][0]["invoices"][0]
            invoice["items"] = []
            invoice["payments"][0]["status"] = "PENDING"
            path.write_text(json.dumps(fixture), encoding="utf-8")
            before = path.read_bytes()
            report = validate_archive(path)
            after = path.read_bytes()
        self.assertEqual("PASS_WITH_REVIEW", report["status"])
        self.assertEqual(1, report["quality"]["invoices_without_items"])
        self.assertEqual({"PENDING": 1}, report["quality"]["payment_status_counts"])
        self.assertEqual(before, after)

    def test_detects_mismatched_customer_product_and_duplicate_source_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.make_archive(Path(temp))
            fixture = json.loads(path.read_text(encoding="utf-8"))
            invoice = fixture["customers"][0]["invoices"][0]
            invoice["source_customer_id"] = 99
            invoice["items"][0]["source_product_id"] = 999
            fixture["products"].append({"source_product_id": 8})
            path.write_text(json.dumps(fixture), encoding="utf-8")
            report = validate_archive(path)
        codes = {issue["code"] for issue in report["issues"]}
        self.assertIn("INVOICE_CUSTOMER_MISMATCH", codes)
        self.assertIn("UNKNOWN_CUSTOMER_REFERENCE", codes)
        self.assertIn("UNKNOWN_PRODUCT_REFERENCE", codes)
        self.assertIn("DUPLICATE_PRODUCT_ID", codes)

    def test_optional_invoice_csv_compares_all_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self.make_archive(root)
            invoice_csv = root / "invoices.csv"
            invoice_csv.write_text("source_invoice_id\n70\n71\n", encoding="utf-8")
            report = validate_archive(archive, invoice_csv)
        self.assertEqual(2, report["invoice_reconciliation_csv"]["rows"])
        self.assertEqual(1, report["invoice_reconciliation_csv"]["csv_ids_missing_from_archive"])
        self.assertEqual(0, report["invoice_reconciliation_csv"]["archive_ids_missing_from_csv"])

    def test_report_path_must_be_private_and_must_not_overwrite(self):
        unsafe_path = REPOSITORY_ROOT / "archive-report.json"
        with self.assertRaises(ArchiveValidationError):
            _validate_private_report_path(unsafe_path)
        safe_path = REPOSITORY_ROOT / "data" / "starplus_private" / "archive-report.json"
        self.assertEqual(safe_path.resolve(), _validate_private_report_path(safe_path))
        with tempfile.TemporaryDirectory() as temp:
            existing = Path(temp) / "existing.json"
            existing.write_text("{}", encoding="utf-8")
            with self.assertRaises(ArchiveValidationError):
                _validate_private_report_path(existing)


if __name__ == "__main__":
    unittest.main()
