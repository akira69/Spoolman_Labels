"""Helpers for extracting JSON Logic field references."""


def _normalize_json_logic_args(raw_value: object) -> list[object]:
    if isinstance(raw_value, list):
        return raw_value
    return [raw_value]


def _collect_json_logic_references(node: object, references: set[str]) -> None:
    if isinstance(node, (str, int, float, bool)) or node is None:
        return
    if isinstance(node, list):
        for value in node:
            _collect_json_logic_references(value, references)
        return
    if not isinstance(node, dict) or len(node) != 1:
        return

    operator, raw_args = next(iter(node.items()))
    args = _normalize_json_logic_args(raw_args)
    if operator == "var":
        if not args:
            return
        reference = args[0]
        if isinstance(reference, str) and reference != "":
            references.add(reference)
        if len(args) > 1:
            _collect_json_logic_references(args[1], references)
        return

    for arg in args:
        _collect_json_logic_references(arg, references)


def collect_json_logic_references(expression_json: dict[str, object]) -> list[str]:
    """Collect unique `var` references from a JSON Logic expression."""
    references: set[str] = set()
    _collect_json_logic_references(expression_json, references)
    return sorted(references)


def get_extra_field_references(expression_json: dict[str, object]) -> list[str]:
    """Collect `extra.<key>` references from a JSON Logic expression."""
    return sorted(
        {
            reference[len("extra.") :]
            for reference in collect_json_logic_references(expression_json)
            if reference.startswith("extra.") and reference[len("extra.") :] != ""
        }
    )
