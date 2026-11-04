"""Custom/extra fields for spoolman entities."""

import json
import logging

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from spoolman.database import filament as db_filament
from spoolman.database import setting as db_setting
from spoolman.database import spool as db_spool
from spoolman.database import vendor as db_vendor
from spoolman.exceptions import ItemNotFoundError
from spoolman.extra_field_registry import (
    EntityType,
    ExtraField,
    ExtraFieldParameters,
    ExtraFieldType,
    add_or_update_extra_field,
    extra_field_cache,
    get_extra_fields,
    validate_extra_field,
    validate_extra_field_dict,
    validate_extra_field_value,
)
from spoolman.formula_references import get_extra_field_references
from spoolman.settings import parse_setting

logger = logging.getLogger(__name__)

__all__ = [
    "EntityType",
    "ExtraField",
    "ExtraFieldParameters",
    "ExtraFieldType",
    "add_or_update_extra_field",
    "delete_extra_field",
    "extra_field_cache",
    "get_extra_fields",
    "populate_with_defaults",
    "validate_extra_field",
    "validate_extra_field_dict",
    "validate_extra_field_value",
]


async def delete_extra_field(db: AsyncSession, entity_type: EntityType, key: str) -> None:  # noqa: C901
    """Delete an extra field for a specific entity type."""
    extra_fields = await get_extra_fields(db, entity_type)

    # Check if the field exists
    if not any(field.key == key for field in extra_fields):
        raise ItemNotFoundError(f"Extra field with key {key} does not exist.")

    derived_setting_def = parse_setting(f"derived_fields_{entity_type.name}")
    try:
        derived_setting = await db_setting.get(db, derived_setting_def)
        derived_setting_value = derived_setting.value
    except ItemNotFoundError:
        derived_setting_value = derived_setting_def.default
    derived_setting_array = json.loads(derived_setting_value)
    dependent_derived_fields: list[str] = []
    if isinstance(derived_setting_array, list):
        for raw_field in derived_setting_array:
            if not isinstance(raw_field, dict):
                continue
            expression_json = raw_field.get("expression_json")
            if not isinstance(expression_json, dict):
                continue
            if key not in get_extra_field_references(expression_json):
                continue
            dependent_derived_fields.append(
                f"{raw_field.get('name', raw_field.get('key', 'unknown'))} ({raw_field.get('key', 'unknown')})"
            )
    if dependent_derived_fields:
        dependencies = ", ".join(dependent_derived_fields)
        raise ValueError(f"Cannot delete extra field {key}; formula fields depend on it: {dependencies}.")

    extra_fields = [field for field in extra_fields if field.key != key]

    setting_def = parse_setting(f"extra_fields_{entity_type.name}")
    await db_setting.update(db=db, definition=setting_def, value=json.dumps(jsonable_encoder(extra_fields)))

    # Update cache
    extra_field_cache[entity_type] = extra_fields

    logger.info("Deleted extra field %r for entity type %r.", key, entity_type.name)

    if entity_type == EntityType.vendor:
        await db_vendor.clear_extra_field(db, key)
    elif entity_type == EntityType.filament:
        await db_filament.clear_extra_field(db, key)
    elif entity_type == EntityType.spool:
        await db_spool.clear_extra_field(db, key)
    else:
        raise ValueError(f"Unknown entity type {entity_type.name}.")


async def populate_with_defaults(db: AsyncSession, entity_type: EntityType, existing: dict[str, str]) -> None:
    """Populate the given list of extra fields with defaults."""
    extra_fields = await get_extra_fields(db, entity_type)
    for extra_field in extra_fields:
        if extra_field.default_value is None:
            continue
        if extra_field.key in existing:
            continue
        existing[extra_field.key] = extra_field.default_value
