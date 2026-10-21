"""Error code catalog. Generated from contract/api_contract.json `x-errorCodes`;
tests/unit/test_error_catalog.py fails if the two drift."""

from enum import StrEnum


class ErrorCode(StrEnum):
    unauthenticated = "unauthenticated"
    invalid_provider_token = "invalid_provider_token"
    forbidden = "forbidden"
    admin_required = "admin_required"
    ai_consent_required = "ai_consent_required"
    not_found = "not_found"
    revision_conflict = "revision_conflict"
    mutation_id_reused = "mutation_id_reused"
    validation_failed = "validation_failed"
    required = "required"
    invalid_format = "invalid_format"
    out_of_range = "out_of_range"
    must_be_positive = "must_be_positive"
    parent_not_found = "parent_not_found"
    dependency_failed = "dependency_failed"
    duplicate_plot_name = "duplicate_plot_name"
    open_season_exists = "open_season_exists"
    care_input_required = "care_input_required"
    input_amount_unit_pair = "input_amount_unit_pair"
    season_mismatch = "season_mismatch"
    expense_link_taken = "expense_link_taken"
    expense_must_delete_with_care_log = "expense_must_delete_with_care_log"
    confirmed_requires_total = "confirmed_requires_total"
    refund_exceeds_receipts = "refund_exceeds_receipts"
    sale_has_payments = "sale_has_payments"
    has_live_children = "has_live_children"
    scan_immutable = "scan_immutable"
    unsupported_plant_part = "unsupported_plant_part"
    unknown_disease_code = "unknown_disease_code"
    media_not_found = "media_not_found"
    item_not_in_version = "item_not_in_version"
    hash_mismatch = "hash_mismatch"
    upload_incomplete = "upload_incomplete"
    translation_incomplete = "translation_incomplete"
    source_missing = "source_missing"
    not_approved = "not_approved"
    invalid_transition = "invalid_transition"
    published_immutable = "published_immutable"
    contact_channel_required = "contact_channel_required"
    rate_limited = "rate_limited"
    llm_unavailable = "llm_unavailable"
    service_unavailable = "service_unavailable"
    index_failed = "index_failed"


# code -> (http status, retryable)
ERROR_META: dict[ErrorCode, tuple[int, bool]] = {
    ErrorCode.unauthenticated: (401, False),
    ErrorCode.invalid_provider_token: (401, False),
    ErrorCode.forbidden: (403, False),
    ErrorCode.admin_required: (403, False),
    ErrorCode.ai_consent_required: (403, False),
    ErrorCode.not_found: (404, False),
    ErrorCode.revision_conflict: (409, False),
    ErrorCode.mutation_id_reused: (422, False),
    ErrorCode.validation_failed: (422, False),
    ErrorCode.required: (422, False),
    ErrorCode.invalid_format: (422, False),
    ErrorCode.out_of_range: (422, False),
    ErrorCode.must_be_positive: (422, False),
    ErrorCode.parent_not_found: (422, False),
    ErrorCode.dependency_failed: (422, False),
    ErrorCode.duplicate_plot_name: (422, False),
    ErrorCode.open_season_exists: (422, False),
    ErrorCode.care_input_required: (422, False),
    ErrorCode.input_amount_unit_pair: (422, False),
    ErrorCode.season_mismatch: (422, False),
    ErrorCode.expense_link_taken: (422, False),
    ErrorCode.expense_must_delete_with_care_log: (422, False),
    ErrorCode.confirmed_requires_total: (422, False),
    ErrorCode.refund_exceeds_receipts: (422, False),
    ErrorCode.sale_has_payments: (422, False),
    ErrorCode.has_live_children: (422, False),
    ErrorCode.scan_immutable: (422, False),
    ErrorCode.unsupported_plant_part: (422, False),
    ErrorCode.unknown_disease_code: (422, False),
    ErrorCode.media_not_found: (422, False),
    ErrorCode.item_not_in_version: (422, False),
    ErrorCode.hash_mismatch: (422, False),
    ErrorCode.upload_incomplete: (422, True),
    ErrorCode.translation_incomplete: (422, False),
    ErrorCode.source_missing: (422, False),
    ErrorCode.not_approved: (422, False),
    ErrorCode.invalid_transition: (422, False),
    ErrorCode.published_immutable: (422, False),
    ErrorCode.contact_channel_required: (422, False),
    ErrorCode.rate_limited: (429, True),
    ErrorCode.llm_unavailable: (503, True),
    ErrorCode.service_unavailable: (503, True),
    ErrorCode.index_failed: (503, True),
}
