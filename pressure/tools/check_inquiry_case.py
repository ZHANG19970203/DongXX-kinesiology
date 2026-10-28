#!/usr/bin/env python3
"""Independently check the two-frame teaching claim from source CSV and JSON.

Uses only the Python standard library. It does not import the viewer, its
calculation functions, or GaitScope code. Run from any directory:
    python pressure/tools/check_inquiry_case.py
The only output file is pressure/data/inquiry-case-verification.json.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import sys
from pathlib import Path


PRESSURE_ROOT = Path(__file__).resolve().parents[1]
CASE_PATH = PRESSURE_ROOT / "data" / "case-p1-np-1.json"
REPORT_PATH = PRESSURE_ROOT / "data" / "inquiry-case-verification.json"
CHANNELS = [f"PressureSensor {index}" for index in range(32)]
EXPECTED = {
    25: {"peak_channel": 27, "peak_value": 2781.0, "sum": 20935.0},
    50: {"peak_channel": 8, "peak_value": 2312.0, "sum": 24620.0},
}
EXPECTED_COLOR_MAX = 2887.0
EXPECTED_THRESHOLD = 3754.65


def require(condition: bool, message: str) -> None:
    """Keep checks active even when Python runs with optimization enabled."""
    if not condition:
        raise ValueError(message)


def near(left: float, right: float, tolerance: float = 1e-9) -> bool:
    return math.isclose(left, right, rel_tol=0.0, abs_tol=tolerance)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify() -> dict:
    case = json.loads(CASE_PATH.read_text(encoding="utf-8-sig"))
    side = case["sides"]["L"]
    source_path = (CASE_PATH.parent / side["sourceFile"]).resolve()
    require(source_path.is_relative_to(PRESSURE_ROOT), "Source path leaves module.")
    with source_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        require(
            all(key in (reader.fieldnames or []) for key in CHANNELS + ["copX", "copY", "sumP"]),
            "Source CSV is missing a required column.",
        )
        rows = list(reader)

    require(case["dataset"]["caseId"] == "P1/NP/1", "Unexpected source case.")
    require(case["dataset"]["nominalHz"] == 64, "Unexpected nominal sampling rate.")
    require(len(rows) == len(side["frames"]) == 249, "Expected 249 left-side frames.")
    require(len(side["points"]) == 32, "Expected 32 drawing-coordinate points.")
    require(digest(source_path) == side["sourceSHA256"], "Source CSV SHA-256 mismatch.")

    # Independently compare all raw left-side channel values and source outputs.
    csv_values = []
    for index, (row, frame) in enumerate(zip(rows, side["frames"])):
        values = [float(row[key]) for key in CHANNELS]
        require(all(math.isfinite(value) and value >= 0 for value in values), "Invalid channel value.")
        require(frame["index"] == index, "JSON frame index differs from source row index.")
        require(len(frame["values"]) == 32, "JSON channel count differs from source.")
        require(values == frame["values"], f"Raw channel values changed at row {index}.")
        require(near(sum(values), float(row["sumP"])), f"Source sum differs at row {index}.")
        require(near(float(row["sumP"]), frame["sum"]), f"JSON sum changed at row {index}.")
        require(
            all(near(float(row[key]), frame["cop"][axis]) for axis, key in enumerate(["copX", "copY"])),
            f"JSON source CoP changed at row {index}.",
        )
        csv_values.append(values)

    color_max = max(max(values) for values in csv_values)
    require(near(color_max, EXPECTED_COLOR_MAX), "Left-clip fixed color-scale maximum changed.")
    max_sum = max(float(row["sumP"]) for row in rows)
    ratio = float(case["teachingAnalysis"]["defaultRelativeSumThreshold"])
    require(near(ratio, 0.15), "Expected a 15% teaching-filter ratio.")
    threshold = round(max_sum * ratio, 2)
    require(near(max_sum, 25031.0), "Left-clip peak channel sum changed.")
    require(near(threshold, EXPECTED_THRESHOLD), "Expected threshold 3754.65.")

    evidence = []
    for index, expected in EXPECTED.items():
        row, values = rows[index], csv_values[index]
        channel_sum = sum(values)
        peak_value = max(values)
        peak_channels = [channel for channel, value in enumerate(values) if value == peak_value]
        require(peak_channels == [expected["peak_channel"]], f"Unexpected maximum channel at L{index}.")
        require(near(peak_value, expected["peak_value"]), f"Unexpected maximum value at L{index}.")
        require(near(channel_sum, expected["sum"]), f"Unexpected channel sum at L{index}.")

        cop = [float(row["copX"]), float(row["copY"])]
        recomputed = [
            sum(value * float(point[axis]) for value, point in zip(values, side["points"])) / channel_sum
            for axis in ("x", "y")
        ]
        require(all(near(a, b) for a, b in zip(cop, recomputed)), f"Weighted source CoP mismatch at L{index}.")
        peak_point = side["points"][expected["peak_channel"]]
        peak_position = [float(peak_point["x"]), float(peak_point["y"])]
        separation = math.dist(cop, peak_position)
        require(separation > 0.01, f"CoP unexpectedly equals the maximum-point location at L{index}.")
        included = channel_sum > 0 and channel_sum >= EXPECTED_THRESHOLD
        require(included, f"L{index} must pass the declared teaching filter.")
        evidence.append(
            {
                "side": "L",
                "zeroBasedFrameIndex": index,
                "nominalTimeSeconds": index / 64,
                "maximumChannel": peak_channels[0],
                "maximumRawValue": peak_value,
                "maximumPointDrawingCoordinates": peak_position,
                "channelSum": channel_sum,
                "sourceCoP": cop,
                "independentlyRecomputedCoP": recomputed,
                "CoPToMaximumPointDrawingDistance": separation,
                "includedAtThreshold3754_65": included,
            }
        )

    first, second = evidence
    delta_cop = [b - a for a, b in zip(first["sourceCoP"], second["sourceCoP"])]
    require(delta_cop[1] < 0, "Expected source CoP y to decrease from L25 to L50.")
    require(second["maximumRawValue"] < first["maximumRawValue"], "Expected the maximum raw channel value to decrease.")
    require(second["channelSum"] > first["channelSum"], "Expected the raw channel sum to increase.")

    return {
        "schemaVersion": "dxx-pressure-inquiry-case-verification-v1",
        "status": "passed",
        "verificationScope": "Independent source-data and arithmetic acceptance; no UI module or GaitScope code imported.",
        "source": {
            "caseId": case["dataset"]["caseId"],
            "datasetDOI": case["dataset"]["doi"],
            "datasetURL": case["dataset"]["url"],
            "sourceCSV": source_path.relative_to(PRESSURE_ROOT).as_posix(),
            "sourceCSV_SHA256": digest(source_path),
            "caseJSON": CASE_PATH.relative_to(PRESSURE_ROOT).as_posix(),
            "caseJSON_SHA256": digest(CASE_PATH),
        },
        "checkedSourceFrames": 249,
        "channelsPerFrame": 32,
        "fixedColorScaleDataContract": {
            "sameLeftClipForBothFrames": True,
            "minimumRawValueForDisplay": 0,
            "maximumRawValueForDisplay": color_max,
            "perFrameRescalingPermitted": False,
            "note": "Verifies the expected data range, not whether a renderer actually applies it.",
        },
        "teachingFilter": {
            "ratioOfSameSidePeakSum": ratio,
            "sameSidePeakSum": max_sum,
            "thresholdRawSum": threshold,
            "rule": "sum >= threshold and sum > 0",
            "bothReferenceFramesIncluded": True,
            "contactEventValidation": False,
        },
        "referenceFrames": evidence,
        "teachingHypothesis": {
            "checked": True,
            "maximumSingleChannelDecreases": True,
            "channelSumIncreases": True,
            "CoPYDecreases": True,
            "CoPDiffersFromMaximumPointInBothFrames": True,
            "deltaSourceCoP": delta_cop,
            "rawChannelSumChange": second["channelSum"] - first["channelSum"],
            "maximumRawChannelChange": second["maximumRawValue"] - first["maximumRawValue"],
            "interpretation": "Within this same-foot source example, the largest raw channel value decreases while the channel sum increases and the weighted source CoP moves toward smaller y (the toe end of the drawing layout).",
        },
        "limits": [
            "Channel values retain the unconverted source scale; no kPa, newton, or physical pressure calibration was validated.",
            "CoP and distances are in source drawing coordinates; physical length units and clinical joint or foot registration were not validated.",
            "Time is zero-based frame index divided by nominal 64 Hz; true timestamps, bilateral synchronization, and contact events were not validated.",
            "The 15% rule is an explicit teaching filter, not a validated foot-contact or clinical threshold.",
            "Column height is a visual encoding contract, not measured tissue height or deformation.",
            "No body centre of mass, treatment effect, physiological prediction, diagnosis, or clinical performance was validated.",
        ],
    }


def main() -> int:
    try:
        report = verify()
    except (KeyError, TypeError, ValueError, OSError, csv.Error) as error:
        report = {"schemaVersion": "dxx-pressure-inquiry-case-verification-v1", "status": "failed", "error": str(error)}
        REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), file=sys.stderr)
        return 1
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "teachingHypothesisChecked": True, "physicalOrClinicalValidation": False, "report": str(REPORT_PATH)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
