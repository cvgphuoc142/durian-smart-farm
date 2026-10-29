"""The manifest entry of one on-device scan model, as the phone reads it.

Mirrors `durianMobile/src/ai/manifest.ts`: the phone drops an entry it cannot parse, so the
server refuses to store one. The file itself (`artifact`) is added by the registry, not authored.
"""

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Unit = Annotated[float, Field(ge=0, le=1)]
Triple = Annotated[list[float], Field(min_length=3, max_length=3)]

_APP_VERSION = re.compile(r"^\d+(\.\d+){0,2}$")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PartLabels(_Strict):
    vi: str = Field(min_length=1)
    en: str = Field(min_length=1)


class ClassLabels(_Strict):
    vi: str | None = Field(None, min_length=1)
    en: str | None = Field(None, min_length=1)


class ClassEntry(_Strict):
    index: int = Field(ge=0)
    kind: Literal["disease", "healthy", "other"]
    disease_code: str | None = Field(None, min_length=1)
    labels: ClassLabels = ClassLabels()


class ModelInput(_Strict):
    name: str = Field(min_length=1)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    layout: Literal["NCHW", "NHWC"]
    color: Literal["RGB", "BGR"]
    scale: float = Field(gt=0)
    mean: Triple
    std: Annotated[list[float], Field(min_length=3, max_length=3)]
    resize: Literal["stretch", "center_crop", "letterbox"]
    pad: Triple | None = None

    @model_validator(mode="after")
    def _check(self) -> "ModelInput":
        if any(s <= 0 for s in self.std):
            raise ValueError("std must be positive")
        if self.resize == "letterbox" and self.pad is None:
            raise ValueError("letterbox needs a pad")
        return self


class ModelOutput(_Strict):
    name: str = Field(min_length=1)
    activation: Literal["softmax", "sigmoid", "none", "temperature_softmax"]
    temperature: float | None = Field(None, gt=0)

    @model_validator(mode="after")
    def _check(self) -> "ModelOutput":
        if self.activation == "temperature_softmax" and self.temperature is None:
            raise ValueError("temperature_softmax needs a temperature")
        return self


class Rules(_Strict):
    suspected_min: Unit
    healthy_min: Unit
    margin_min: Unit | None = None
    energy_max: float | None = None


class ModelEntryBody(_Strict):
    """Everything about a model except its file."""

    model_id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    pipeline_version: str = Field(min_length=1)
    threshold_version: str = Field(min_length=1)
    plant_part: str = Field(min_length=1)
    part_labels: PartLabels
    runtime: Literal["onnx"] = "onnx"
    input: ModelInput
    output: ModelOutput
    classes: Annotated[list[ClassEntry], Field(min_length=2)]
    rules: Rules
    # What the farmer is told when this version is offered (Vietnamese).
    release_notes: str = Field(min_length=1)
    # `beta` shows "model still being improved" on the part picker and the result.
    maturity: Literal["stable", "beta"]
    # True only when the model has a healthy class; the app shows "Khỏe" only then.
    supports_healthy: bool
    limitations: str | None = None
    # Apps older than this ignore the entry and ask the user to update the app.
    min_app_version: str | None = None

    @model_validator(mode="after")
    def _check(self) -> "ModelEntryBody":
        seen: set[int] = set()
        for c in self.classes:
            if c.index in seen:
                raise ValueError(f"duplicate class index {c.index}")
            seen.add(c.index)
            if c.kind == "disease" and not c.disease_code:
                raise ValueError("a disease class needs a disease_code")
            if c.kind != "disease" and c.disease_code:
                raise ValueError("only a disease class has a disease_code")
        has_healthy = any(c.kind == "healthy" for c in self.classes)
        if has_healthy != self.supports_healthy:
            raise ValueError("supports_healthy must match the presence of a healthy class")
        if self.min_app_version is not None and not _APP_VERSION.match(self.min_app_version):
            raise ValueError("min_app_version must look like 1.2.3")
        return self

    def to_wire(self) -> dict[str, Any]:
        """What is stored and served. Absent options are left out (the phone's schema has no null
        for them) except `disease_code`, which is an explicit null on non-disease classes."""
        wire = self.model_dump(mode="json", exclude_none=True)
        for c in wire["classes"]:
            c.setdefault("disease_code", None)
        return wire
