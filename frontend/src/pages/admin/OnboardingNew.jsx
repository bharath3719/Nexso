import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Stack, Text, TextField, Dropdown,
  PrimaryButton, DefaultButton, IconButton,
  Spinner, SpinnerSize, MessageBar, MessageBarType,
  Icon, Pivot, PivotItem,
  Dialog, DialogType, DialogFooter,
} from "@fluentui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../services/api.js";
import { T } from "../../styles/typography.js";
import { validatePhone, validateEmail } from "../../utils/validation.js";
import {
  INPUT_STYLES, PRIMARY_BTN,
  // Stepper
  STEPPER_CONTAINER, stepperCircle, STEPPER_CHECK, stepperLabel,
  // Sub-components
  SECTION_ICON, SECTION_TITLE,
  // Step 2
  TOWER_SIDEBAR, TOWER_SIDEBAR_HEADER, towerItem, towerItemLabel,
  TOWER_ICON_BTN, FLOOR_ICON_BTN, STEP_FOOTER,
  // Step 3
  EMPTY_STATE_WRAPPER, DROP_ZONE,
  // Success
  SUCCESS_ICON_CIRCLE, BUILDING_ID_BADGE, STAT_ICON_WRAP,
  // Main card
  MAIN_CARD,
  // Text utilities
  MUTED_TEXT, SECONDARY_TEXT, BOLD_DARK,
  // Icon utilities
  ICON_BLUE, ICON_BLUE_20, ICON_BLUE_30,
  ICON_GREY_13, ICON_PURPLE_16, ICON_GREEN_16, ICON_GREEN_18,
  ICON_WHITE_13, ICON_13, ICON_14, ICON_12,
  ICON_BACK, ICON_UPLOAD_36, ICON_SUCCESS_24, ICON_SUCCESS_44,
  // Shared layout
  FLEX_1, NUMBER_FIELD_STACK, SECTION_BODY, MSG_BAR_TOP, SPINNER_INLINE,
  STEP1_FOOTER, STEP2_MAIN, LOADING_WRAP,
  // Step 1
  SOCIETY_NAME_INPUT, SOCIETY_TYPE_DROPDOWN, TEXTAREA_STYLES,
  // Step 2
  TOWER_SIDEBAR_LABEL, ADD_TOWER_FOOTER, ADD_TOWER_BTN, ADD_FLOOR_BTN, BACK_BTN,
  // Step 3
  DROP_ZONE_TITLE,
  CHANGE_FILE_BTN, CONFIRM_IMPORT_BTN, PARSED_COUNT,
  // Success screen
  SUCCESS_OUTER, BUILDING_ID_LABEL, BUILDING_ID_VALUE, STAT_VALUE,
} from "../../styles/onboardingNewStyles.js";
import { CredentialsBox } from "../../components/onboarding/CredentialsBox.jsx";
import "../../styles/onboardingNew.css";
import {
  SOCIETY_TYPES, STEPS, BUILDING_FORM_DEFAULTS,
  XLSX_TABLE_KEYS, XLSX_TABLE_HEADERS,
  BHK_OPTIONS, CONTACT_OPTIONS,
  buildDefaultFloors, initTowers,
  parseXlsx, generateTemplateXlsx, countTotalUnits,
} from "../../utils/onboardingUtils.js";
import { AddResidentModal }      from "../../components/onboarding/AddResidentModal.jsx";
import { StructurePreviewModal } from "../../components/onboarding/StructurePreviewModal.jsx";

// Merges T.pageSubtitle with centred/max-width overrides — kept here because it
// references T which is a local import, not a style-file concern.
const SUCCESS_SUBTITLE = { root: { ...T.pageSubtitle?.root, textAlign: "center", maxWidth: 400 } };

// ─── Visual Stepper ───────────────────────────────────────────────────────────

function Stepper({ current }) {
  return (
    <Stack
      horizontal
      verticalAlign="center"
      horizontalAlign="center"
      styles={STEPPER_CONTAINER}
    >
      {STEPS.map((step, idx) => {
        const state = idx < current ? "done" : idx === current ? "active" : "pending";
        return (
          <React.Fragment key={step.label}>
            {idx > 0 && <div className={`on-stepper-connector${idx <= current ? " on-stepper-connector--active" : ""}`} />}
            <Stack horizontalAlign="center" tokens={{ childrenGap: 6 }}>
              <Stack
                horizontalAlign="center"
                verticalAlign="center"
                styles={stepperCircle(state)}
              >
                {state === "done" ? (
                  <Icon iconName="CheckMark" styles={STEPPER_CHECK} />
                ) : (
                  <Text styles={stepperLabel(state)}>{idx + 1}</Text>
                )}
              </Stack>
              <Text variant="small" styles={stepperLabel(state)}>
                {step.label}
              </Text>
            </Stack>
          </React.Fragment>
        );
      })}
    </Stack>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
      <Icon iconName={icon} styles={SECTION_ICON} />
      <Text variant="mediumPlus" styles={SECTION_TITLE}>{title}</Text>
    </Stack>
  );
}

function InfoTooltip({ text }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="on-tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div className="on-tooltip-icon">
        <span className="on-tooltip-i-label">i</span>
      </div>
      {visible && (
        <div className="on-tooltip-bubble">
          {text}
          <div className="on-tooltip-arrow" />
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, min = 1, max = 999, hint, infoTooltip }) {
  return (
    <Stack tokens={{ childrenGap: 4 }} styles={NUMBER_FIELD_STACK}>
      <div className="on-number-field-label-row">
        <span className="on-number-field-label">{label}</span>
        {infoTooltip && <InfoTooltip text={infoTooltip} />}
      </div>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="on-number-input"
      />
      {hint && <Text variant="xSmall" styles={MUTED_TEXT}>{hint}</Text>}
    </Stack>
  );
}

// Uncontrolled floor unit input — avoids comma-eating bug where FluentUI
// TextField re-derives value from units[] on every keystroke.
function FloorUnitInput({ units, onChange }) {
  const [text, setText] = useState(units.join(", "));

  // Sync when parent units change (e.g. switching towers resets floor list)
  const unitsKey = units.join(",");
  useEffect(() => {
    setText(units.join(", "));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsKey]);

  const liveCount = text.split(",").map((u) => u.trim()).filter(Boolean).length;

  const commit = () => {
    const parsed = text.split(",").map((u) => u.trim()).filter(Boolean);
    onChange(parsed);
    setText(parsed.join(", "));
  };

  return (
    <div className="on-floor-unit-wrap">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        placeholder="e.g. 101, 102, 103"
        className="on-floor-unit-input"
      />
      <span className={`on-unit-count${liveCount > 0 ? " on-unit-count--active" : ""}`}>
        {liveCount} {liveCount === 1 ? "unit" : "units"}
      </span>
    </div>
  );
}

// ─── Step 1: Building Details ─────────────────────────────────────────────────

function Step1({ form, setForm, onNext, loading, error, fieldErrors = {} }) {
  const update = (key) => (_, val) => setForm((f) => ({ ...f, [key]: val ?? "" }));

  return (
    <Stack tokens={{ childrenGap: 0 }}>
      <SectionHeader icon="CityNext" title="Basic Information" />
      <Stack tokens={{ childrenGap: 14 }} styles={SECTION_BODY}>
        <Stack horizontal tokens={{ childrenGap: 16 }}>
          <TextField
            label="Society / Building Name"
            placeholder="e.g. Sunrise Residency"
            value={form.name} onChange={update("name")} required
            styles={SOCIETY_NAME_INPUT}
          />
          <Dropdown
            label="Society Type"
            selectedKey={form.society_type}
            options={SOCIETY_TYPES}
            onChange={(_, opt) => setForm((f) => ({ ...f, society_type: opt.key }))}
            styles={SOCIETY_TYPE_DROPDOWN}
          />
        </Stack>
        <TextField
          label="Address"
          placeholder="Full address including city, state and pincode"
          value={form.address} onChange={update("address")}
          multiline rows={2}
          styles={TEXTAREA_STYLES}
        />
      </Stack>

      <div className="on-divider" />

      <SectionHeader icon="Sections" title="Building Structure" />
      <Stack horizontal tokens={{ childrenGap: 16 }} styles={SECTION_BODY} wrap>
        <NumberField
          label="Number of Towers"
          value={form.num_towers}
          onChange={(v) => setForm((f) => ({ ...f, num_towers: v }))}
          min={1} max={50} hint="Towers / Blocks / Wings"
          infoTooltip="This is just a starting point. In the next step you can freely add, remove, or rename towers — the actual structure you define there is what gets saved."
        />
        <NumberField
          label="Floors per Tower"
          value={form.num_floors}
          onChange={(v) => setForm((f) => ({ ...f, num_floors: v }))}
          min={1} max={200} hint="Default floor count"
          infoTooltip="Sets the default floor count for each tower. In Step 2 you can freely add or remove floors per tower individually — the structure you define there is what gets saved."
        />
        <NumberField
          label="Units per Floor"
          value={form.num_units}
          onChange={(v) => setForm((f) => ({ ...f, num_units: v }))}
          min={1} max={100} hint="Default units / floor"
          infoTooltip="Sets the default number of units on each floor. You can customise unit numbers per floor individually in Step 2."
        />
      </Stack>

      <div className="on-divider" />

      <SectionHeader icon="Contact" title="Contact Information" />
      <Stack tokens={{ childrenGap: 14 }} styles={SECTION_BODY}>
        <Stack horizontal tokens={{ childrenGap: 16 }}>
          <TextField label="Contact Person"  placeholder="e.g. Ramesh Kumar"  value={form.contact_person} onChange={update("contact_person")} styles={INPUT_STYLES} />
          <TextField
            label="Phone Number"
            placeholder="e.g. 9876543210 or +91 98765 43210"
            value={form.contact_phone}
            onChange={update("contact_phone")}
            styles={INPUT_STYLES}
            errorMessage={fieldErrors.contact_phone}
          />
          <TextField
            label="Email"
            placeholder="admin@society.com"
            value={form.contact_email}
            onChange={update("contact_email")}
            styles={INPUT_STYLES}
            errorMessage={fieldErrors.contact_email}
          />
        </Stack>
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} styles={MSG_BAR_TOP}>
          {error}
        </MessageBar>
      )}

      <Stack horizontal horizontalAlign="end" styles={STEP1_FOOTER}>
        <PrimaryButton
          text="Save & Next: Unit Structure"
          iconProps={{ iconName: "ChevronRight" }}
          onClick={onNext}
          disabled={loading || !form.name?.trim()}
          styles={PRIMARY_BTN}
        >
          {loading && <Spinner size={SpinnerSize.small} styles={SPINNER_INLINE} />}
        </PrimaryButton>
      </Stack>
    </Stack>
  );
}

// ─── Step 2: Unit Structure ───────────────────────────────────────────────────

function Step2({ towers, setTowers, onBack, onNext, loading, error }) {
  const [selectedTowerIdx, setSelectedTowerIdx] = useState(0);
  const selectedTower = towers[selectedTowerIdx] || null;

  const updateTower = (idx, changes) =>
    setTowers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...changes } : t)));

  const addTower = () => {
    const letter        = String.fromCharCode(65 + towers.length);
    const defaultFloors = selectedTower?.floors?.length || 3;
    const defaultUnits  = selectedTower?.floors?.[0]?.units?.length || 4;
    setTowers((prev) => [
      ...prev,
      { name: `Tower ${letter}`, floors: buildDefaultFloors(defaultFloors, defaultUnits) },
    ]);
    setSelectedTowerIdx(towers.length);
  };

  const removeTower = (idx) => {
    if (towers.length <= 1) return;
    setTowers((prev) => prev.filter((_, i) => i !== idx));
    setSelectedTowerIdx(Math.max(0, idx - 1));
  };

  const updateFloorUnits = (floorIdx, parsedUnits) =>
    setTowers((prev) =>
      prev.map((t, i) =>
        i === selectedTowerIdx
          ? { ...t, floors: t.floors.map((f, fi) => (fi === floorIdx ? { ...f, units: parsedUnits } : f)) }
          : t,
      ),
    );

  const addFloor = () => {
    const currentFloors = towers[selectedTowerIdx]?.floors || [];
    const existingNums  = new Set(currentFloors.map((f) => f.floor_number));
    let nextFloorNum = 1;
    while (existingNums.has(nextFloorNum)) nextFloorNum++;

    const defaultUnitCount = currentFloors[0]?.units?.length || 4;
    const newUnits = Array.from(
      { length: defaultUnitCount },
      (_, ui) => `${nextFloorNum}${String(ui + 1).padStart(2, "0")}`,
    );
    setTowers((prev) =>
      prev.map((t, i) =>
        i === selectedTowerIdx
          ? {
              ...t,
              floors: [...t.floors, { floor_number: nextFloorNum, units: newUnits }]
                .sort((a, b) => a.floor_number - b.floor_number),
            }
          : t,
      ),
    );
  };

  // Live update while typing — no validation yet
  const updateFloorNumber = (floorIdx, newNum) =>
    setTowers((prev) =>
      prev.map((t, i) =>
        i === selectedTowerIdx
          ? { ...t, floors: t.floors.map((f, fi) => (fi === floorIdx ? { ...f, floor_number: newNum } : f)) }
          : t,
      ),
    );

  // On blur: resolve duplicates by finding the nearest free floor number, then sort
  const commitFloorNumber = (floorIdx) =>
    setTowers((prev) =>
      prev.map((t, i) => {
        if (i !== selectedTowerIdx) return t;
        const entered   = t.floors[floorIdx]?.floor_number ?? 1;
        const otherNums = new Set(t.floors.filter((_, fi) => fi !== floorIdx).map((f) => f.floor_number));
        let resolved    = entered;
        if (otherNums.has(resolved)) {
          for (let delta = 1; delta <= 999; delta++) {
            if (!otherNums.has(entered + delta))                          { resolved = entered + delta; break; }
            if (entered - delta >= 1 && !otherNums.has(entered - delta)) { resolved = entered - delta; break; }
          }
        }
        const updatedFloors = t.floors
          .map((f, fi) => (fi === floorIdx ? { ...f, floor_number: resolved } : f))
          .sort((a, b) => a.floor_number - b.floor_number);
        return { ...t, floors: updatedFloors };
      }),
    );

  const removeFloor = (floorIdx) => {
    if ((towers[selectedTowerIdx]?.floors?.length || 0) <= 1) return;
    setTowers((prev) =>
      prev.map((t, i) =>
        i === selectedTowerIdx
          ? { ...t, floors: t.floors.filter((_, fi) => fi !== floorIdx) }
          : t,
      ),
    );
  };

  const totalUnits = countTotalUnits(towers);

  return (
    <Stack tokens={{ childrenGap: 0 }}>
      <Stack horizontal tokens={{ childrenGap: 16 }} styles={STEP2_MAIN}>

        {/* Tower sidebar */}
        <Stack styles={TOWER_SIDEBAR}>
          <Stack styles={TOWER_SIDEBAR_HEADER}>
            <Text variant="small" styles={TOWER_SIDEBAR_LABEL}>TOWERS</Text>
          </Stack>

          {towers.map((tower, idx) => {
            const selected = idx === selectedTowerIdx;
            return (
              <Stack
                key={idx}
                horizontal verticalAlign="center" horizontalAlign="space-between"
                onClick={() => setSelectedTowerIdx(idx)}
                styles={towerItem(selected)}
              >
                <Stack tokens={{ childrenGap: 1 }}>
                  <Text variant="small" styles={towerItemLabel(selected)}>
                    {tower.name}
                  </Text>
                  <Text variant="xSmall" styles={MUTED_TEXT}>
                    {tower.floors.length} fl · {tower.floors.reduce((s, f) => s + f.units.length, 0)} units
                  </Text>
                </Stack>
                {towers.length > 1 && (
                  <IconButton
                    iconProps={{ iconName: "Cancel" }}
                    title="Remove tower"
                    onClick={(e) => { e.stopPropagation(); removeTower(idx); }}
                    styles={TOWER_ICON_BTN}
                  />
                )}
              </Stack>
            );
          })}

          <Stack styles={ADD_TOWER_FOOTER}>
            <DefaultButton
              text="Add Tower" iconProps={{ iconName: "Add" }} onClick={addTower}
              styles={ADD_TOWER_BTN}
            />
          </Stack>
        </Stack>

        {/* Tower detail panel */}
        {selectedTower && (
          <Stack grow tokens={{ childrenGap: 16 }}>
            {/* Tower header */}
            <div className="on-tower-header">
              <div className="on-tower-name-group">
                <Icon iconName="BuildingEnterpriseCheck" styles={ICON_BLUE_20} />
                <input
                  value={selectedTower.name}
                  onChange={(e) => updateTower(selectedTowerIdx, { name: e.target.value })}
                  className="on-tower-name-input"
                />
              </div>
              <div className="on-tower-actions">
                <div className="on-tower-stats-pill">
                  <Icon iconName="Sections" styles={ICON_GREY_13} />
                  <span className="on-tower-stats-text">
                    {selectedTower.floors.length} floor{selectedTower.floors.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <DefaultButton
                  text="Add Floor" iconProps={{ iconName: "Add" }} onClick={addFloor}
                  styles={ADD_FLOOR_BTN}
                />
              </div>
            </div>

            <div className="on-floor-hint">
              Edit the floor number on the left to rename it. Enter unit numbers separated by commas. Press Tab or click away to save.
            </div>

            {/* Floors list */}
            <div className="on-floor-list">
              {selectedTower.floors.map((floor, fi) => (
                <div key={fi} className="on-floor-row">
                  <div className="on-floor-num-group">
                    <span className="on-floor-num-label">Floor</span>
                    <input
                      type="number" min={0} value={floor.floor_number}
                      onChange={(e) => updateFloorNumber(fi, Number(e.target.value))}
                      onBlur={() => commitFloorNumber(fi)}
                      title="Edit floor number"
                      className="on-floor-num-input"
                    />
                  </div>
                  <FloorUnitInput units={floor.units} onChange={(parsed) => updateFloorUnits(fi, parsed)} />
                  {selectedTower.floors.length > 1 && (
                    <IconButton
                      iconProps={{ iconName: "Cancel" }} title="Remove floor" onClick={() => removeFloor(fi)}
                      styles={FLOOR_ICON_BTN}
                    />
                  )}
                </div>
              ))}
            </div>
          </Stack>
        )}
      </Stack>

      {/* Footer */}
      <Stack
        horizontal verticalAlign="center" horizontalAlign="space-between"
        styles={STEP_FOOTER}
      >
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
            <Icon iconName="GridViewSmall" styles={SECTION_ICON} />
            <Text variant="medium" styles={BOLD_DARK}>{totalUnits}</Text>
            <Text variant="small"  styles={SECONDARY_TEXT}>total units</Text>
          </Stack>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
            <Icon iconName="BuildingEnterpriseCheck" styles={ICON_PURPLE_16} />
            <Text variant="medium" styles={BOLD_DARK}>{towers.length}</Text>
            <Text variant="small"  styles={SECONDARY_TEXT}>towers</Text>
          </Stack>
        </Stack>
        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <DefaultButton text="Back" iconProps={{ iconName: "ChevronLeft" }} onClick={onBack}
            styles={BACK_BTN} />
          <PrimaryButton
            text="Save & Next: Residents"
            iconProps={{ iconName: "ChevronRight" }}
            onClick={onNext} disabled={loading || totalUnits === 0}
            styles={PRIMARY_BTN}
          >
            {loading && <Spinner size={SpinnerSize.small} styles={SPINNER_INLINE} />}
          </PrimaryButton>
        </Stack>
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} styles={MSG_BAR_TOP}>
          {error}
        </MessageBar>
      )}
    </Stack>
  );
}

// ─── XLSX preview inline-edit helpers ─────────────────────────────────────────

function validateRowPhone(data) {
  const phone = (data.phone || "").replace(/[\s\-().+]/g, "");
  if (phone && !/^\d{10}$/.test(phone)) return "Phone must be exactly 10 digits";
  return null;
}

function validateRowEmail(data) {
  const email = (data.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
  return null;
}

function validateRowAadhar(data) {
  const aadhar = (data.aadhar_number || "").replace(/\s/g, "");
  if (aadhar && !/^\d{12}$/.test(aadhar)) return "Aadhar must be exactly 12 digits";
  return null;
}

function validateRowMaintenance(data) {
  if ((data.maintenance_enabled || "").toUpperCase() !== "YES") return null;
  const errs = {};
  const amount = Number(data.maintenance_amount);
  if (!data.maintenance_amount || amount <= 0) errs.maintenance_amount = "Amount required when maintenance is enabled";
  const day = Number(data.maintenance_due_day);
  if (!data.maintenance_due_day || day < 1 || day > 28) errs.maintenance_due_day = "Due day must be between 1 and 28";
  return errs;
}

function validateRowStructure(data, towers) {
  if (!towers.length) return null;
  const towerName = (data.tower || "").trim();
  const towerObj  = towerName ? towers.find((t) => t.name.toLowerCase() === towerName.toLowerCase()) : null;
  if (towerName && !towerObj) return { tower: `Tower "${towerName}" not found in your building structure` };
  if (!towerObj) return null;

  const rawFloor = data.floor !== undefined && data.floor !== "" ? data.floor : null;
  if (rawFloor === null) return null;

  const floorObj = towerObj.floors.find((f) => f.floor_number === Number(rawFloor));
  if (!floorObj) return { floor: `Floor ${rawFloor} doesn't exist in ${towerObj.name}` };

  if (data.unit_number) {
    const unitStr   = String(data.unit_number).trim().toLowerCase();
    const unitFound = floorObj.units.some((u) => String(u).trim().toLowerCase() === unitStr);
    if (!unitFound) return { unit_number: `Unit ${data.unit_number} not on Floor ${rawFloor} of ${towerObj.name}` };
  }

  return null;
}

/**
 * Returns { fieldKey: errorMessage } for any invalid fields in a preview row.
 * Pass `towers` (from Step-2 state) to enable structural validation of
 * tower / floor / unit against what was actually defined.
 */
function validatePreviewRow(data, towers = []) {
  const errs = {};
  if (!(data.resident_name || data.name || "").trim()) errs.resident_name = "Name is required";

  const phoneErr = validateRowPhone(data);     if (phoneErr)  errs.phone          = phoneErr;
  const emailErr = validateRowEmail(data);     if (emailErr)  errs.email          = emailErr;
  const aadharErr = validateRowAadhar(data);   if (aadharErr) errs.aadhar_number  = aadharErr;

  const maintErrs   = validateRowMaintenance(data);   if (maintErrs)   Object.assign(errs, maintErrs);
  const structErrs  = validateRowStructure(data, towers); if (structErrs) Object.assign(errs, structErrs);

  return errs;
}

// ── EditCell sub-components ──────────────────────────────────────────────────

function TowerSelect({ selectCls, tip, value, towers, onChange }) {
  return (
    <select className={selectCls} value={value} title={tip} onChange={(e) => onChange(e.target.value)}>
      {towers.map((t, i) => <option key={i} value={t.name}>{t.name}</option>)}
    </select>
  );
}

function FloorSelect({ selectCls, tip, value, activeTower, onChange }) {
  const floorNums = activeTower?.floors.map((f) => f.floor_number) || [];
  return (
    <select className={`${selectCls} on-preview-edit-number`} value={value || ""} title={tip}
            onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {floorNums.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

function UnitSelect({ inputCls, selectCls, tip, value, activeTower, rowData, onChange }) {
  const floorObj = activeTower?.floors.find((f) => f.floor_number === Number(rowData.floor));
  if (floorObj?.units?.length) {
    return (
      <select className={selectCls} value={value || ""} title={tip}
              onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {floorObj.units.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    );
  }
  return <input className={inputCls} value={value || ""} placeholder="select floor first"
                onChange={(e) => onChange(e.target.value)} title={tip} />;
}

const NUMERIC_META = {
  maintenance_due_day: { min: 1, max: 28,        placeholder: "1–28" },
  family_members:      { min: 0, max: 20,        placeholder: ""      },
  maintenance_amount:  { min: 0, max: undefined, placeholder: "₹"    },
};

function NumericInput({ fieldKey, inputCls, tip, value, onChange }) {
  const { min, max, placeholder } = NUMERIC_META[fieldKey];
  return (
    <input type="number" min={min} max={max} placeholder={placeholder}
           className={`${inputCls} on-preview-edit-number`}
           value={value || ""}
           onChange={(e) => onChange(e.target.value)}
           title={tip} />
  );
}

/**
 * Per-field input renderer for the inline XLSX-preview edit row.
 * `rowData` is the full editing row — used by `floor` and `unit_number` to
 * show only the floors/units that actually exist in the Step-2 structure.
 */
function EditCell({ fieldKey, value, onChange, towers, error, rowData = {} }) {
  const inputCls  = `on-preview-edit-input${error ? " on-preview-edit-input--error" : ""}`;
  const selectCls = `on-preview-select${error      ? " on-preview-edit-input--error" : ""}`;
  const tip = error || undefined;
  const activeTower = towers.find((t) => t.name.toLowerCase() === (rowData.tower || "").toLowerCase()) || towers[0];
  const shared = { selectCls, inputCls, tip, value, onChange, activeTower, towers, rowData, fieldKey };

  if (fieldKey === "tower")              return <TowerSelect {...shared} />;
  if (fieldKey === "floor")              return <FloorSelect {...shared} />;
  if (fieldKey === "unit_number")        return <UnitSelect  {...shared} />;
  if (fieldKey in NUMERIC_META)          return <NumericInput {...shared} />;

  if (fieldKey === "type")
    return <select className={selectCls} value={value || "OWNER"} title={tip} onChange={(e) => onChange(e.target.value)}>
      <option value="OWNER">Owner</option><option value="TENANT">Tenant</option>
    </select>;

  if (fieldKey === "bhk")
    return <select className={selectCls} value={value} title={tip} onChange={(e) => onChange(e.target.value)}>
      <option value="">— None —</option>
      {BHK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
    </select>;

  if (fieldKey === "preferred_contact")
    return <select className={selectCls} value={value || "WHATSAPP"} title={tip} onChange={(e) => onChange(e.target.value)}>
      {CONTACT_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
    </select>;

  if (fieldKey === "maintenance_enabled")
    return <select className={selectCls} value={(value || "NO").toUpperCase()} title={tip} onChange={(e) => onChange(e.target.value)}>
      <option value="NO">No</option><option value="YES">Yes</option>
    </select>;

  // resident_name, phone, email, aadhar_number
  return <input className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)} title={tip} />;
}

// ─── Step 3: Residents ────────────────────────────────────────────────────────

function Step3({ societyId, towers, residents, setResidents, onBack, onFinish, loading, error }) {
  const [importMode,       setImportMode      ] = useState("manual");
  const [csvPreview,       setCsvPreview      ] = useState(null);
  const [showAllPreview,   setShowAllPreview  ] = useState(false);
  const [editPreviewIdx,   setEditPreviewIdx  ] = useState(null);
  const [editPreviewData,  setEditPreviewData ] = useState(null);
  const [editErrors,       setEditErrors      ] = useState({});
  const [showAddModal,     setShowAddModal    ] = useState(false);
  const [showPreview,      setShowPreview     ] = useState(false);
  const [addModalPreset,   setAddModalPreset  ] = useState(null);
  const [editResident,     setEditResident    ] = useState(null);
  const fileRef = useRef();

  // Guard credentials state
  const [guardUsername,    setGuardUsername  ] = useState("");
  const [guardPassword,    setGuardPassword  ] = useState("");
  const [guardConfirm,     setGuardConfirm  ] = useState("");
  const [guardLoading,     setGuardLoading  ] = useState(false);
  const [guardError,       setGuardError    ] = useState(null);
  const [guardSaved,       setGuardSaved    ] = useState(false);
  const [existingGuard,    setExistingGuard ] = useState(null); // { exists, username }

  useEffect(() => {
    if (!societyId) return;
    api.onboarding.getGuardAccount(societyId)
      .then((d) => {
        setExistingGuard(d);
        if (d.exists && d.username) setGuardUsername(d.username);
      })
      .catch(() => {});
  }, [societyId]);

  const handleSaveGuard = async (e) => {
    e.preventDefault();
    if (!guardUsername.trim()) { setGuardError("Username is required."); return; }
    if (guardPassword.length < 6) { setGuardError("Password must be at least 6 characters."); return; }
    if (guardPassword !== guardConfirm) { setGuardError("Passwords do not match."); return; }
    setGuardLoading(true); setGuardError(null); setGuardSaved(false);
    try {
      await api.onboarding.setGuardAccount(societyId, { username: guardUsername.trim(), password: guardPassword });
      setGuardSaved(true);
      setGuardPassword(""); setGuardConfirm("");
      setExistingGuard({ exists: true, username: guardUsername.trim() });
    } catch (err) {
      setGuardError(err.code === "username_taken" ? "That username is already taken. Choose another." : "Failed to save guard account.");
    } finally {
      setGuardLoading(false);
    }
  };

  const startEditPreview  = (idx) => {
    setEditPreviewIdx(idx);
    setEditPreviewData({ ...csvPreview[idx] });
    setEditErrors({});
  };
  const cancelEditPreview = () => {
    setEditPreviewIdx(null);
    setEditPreviewData(null);
    setEditErrors({});
  };
  const saveEditPreview = () => {
    const errs = validatePreviewRow(editPreviewData, towers); // pass towers for structural check
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    setCsvPreview((prev) => prev.map((r, i) => (i === editPreviewIdx ? editPreviewData : r)));
    setEditPreviewIdx(null);
    setEditPreviewData(null);
    setEditErrors({});
  };

  // Per-row errors for ALL filled rows — drives row highlighting + Confirm Import guard
  const rowErrors = useMemo(
    () => (csvPreview || []).map((row) => {
      if (!(row.resident_name || row.name || "").trim()) return {}; // skip empty rows
      return validatePreviewRow(row, towers);
    }),
    [csvPreview, towers],
  );
  const errorRowCount = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  const deletePreviewRow  = (idx) => {
    setCsvPreview((prev) => prev.filter((_, i) => i !== idx));
    if (editPreviewIdx === idx) { setEditPreviewIdx(null); setEditPreviewData(null); }
  };

  const openAddModal = (preset = null) => {
    setAddModalPreset(preset);
    setShowPreview(false);
    setShowAddModal(true);
  };

  const openEditModal = (resident) => {
    setEditResident(resident);
    setShowPreview(false);
  };

  const handleEditSave = (updated) => {
    setResidents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditResident(null);
  };

  const removeRow = (id) => setResidents((prev) => prev.filter((r) => r.id !== id));

  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvPreview(parseXlsx(ev.target.result));
    reader.readAsArrayBuffer(file);
  };

  const confirmCsvImport = () => {
    if (!csvPreview) return;
    // Skip rows with no resident name — the template pre-fills every unit as
    // empty rows so admins only fill in the ones they know.
    const filledRows = csvPreview.filter(
      (r) => (r.resident_name || r.name || "").trim() !== "",
    );
    setResidents(
      filledRows.map((r, i) => {
        const towerName = (r.tower || "").trim();
        const tower_idx = towerName
          ? Math.max(0, towers.findIndex((t) => t.name.toLowerCase() === towerName.toLowerCase()))
          : 0;

        // Normalise maintenance_enabled — accept "YES"/"yes"/"true"/"1" as truthy
        const rawEnabled = String(r.maintenance_enabled || "").trim().toUpperCase();
        const maintEnabled = rawEnabled === "YES" || rawEnabled === "TRUE" || rawEnabled === "1";

        return {
          id:                   Date.now() + i,
          tower_idx,
          // Keep the original tower name so the backend can do precise lookup
          tower:                towerName || towers[tower_idx]?.name || "",
          floor:                r.floor || "",
          unit_number:          r.unit_number || "",
          name:                 r.resident_name || r.name || "",
          phone:                r.phone || "",
          email:                r.email || "",
          aadhar_number:        r.aadhar_number || "",
          preferred_contact:    (r.preferred_contact || "WHATSAPP").toUpperCase(),
          bhk:                  r.bhk || "",
          resident_type:        (r.type || "OWNER").toUpperCase(),
          family_members:       Number(r.family_members || 0),
          // Maintenance fields (new)
          maintenance_enabled:  maintEnabled,
          maintenance_amount:   r.maintenance_amount !== "" && r.maintenance_amount != null
                                  ? Number(r.maintenance_amount) || null
                                  : null,
          maintenance_due_day:  r.maintenance_due_day !== "" && r.maintenance_due_day != null
                                  ? Number(r.maintenance_due_day) || null
                                  : null,
        };
      }),
    );
    setCsvPreview(null);
    setImportMode("manual");
  };

  const handleDownloadTemplate = () => {
    const xlsxBytes = generateTemplateXlsx(towers);
    const blob = new Blob([xlsxBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "residents_template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalUnits = countTotalUnits(towers);

  return (
    <>
      {showAddModal && (
        <AddResidentModal
          towers={towers} residents={residents}
          initialTowerIdx={addModalPreset?.towerIdx ?? 0}
          initialFloorIdx={addModalPreset?.floorIdx ?? null}
          initialUnit={addModalPreset?.unit ?? ""}
          onAdd={(r) => setResidents((prev) => [...prev, r])}
          onClose={() => { setShowAddModal(false); setAddModalPreset(null); }}
        />
      )}
      {editResident && (
        <AddResidentModal
          towers={towers} residents={residents}
          editResident={editResident}
          onSave={handleEditSave}
          onClose={() => setEditResident(null)}
        />
      )}
      {showPreview && (
        <StructurePreviewModal
          towers={towers} residents={residents}
          onClose={() => setShowPreview(false)}
          onUnitClick={(ti, fi, unit) => openAddModal({ towerIdx: ti, floorIdx: fi, unit })}
        />
      )}

      <Stack tokens={{ childrenGap: 0 }}>
        {/* Header row: Pivot + Preview button */}
        <div className="on-tab-header-row">
          <Pivot selectedKey={importMode} onLinkClick={(item) => setImportMode(item.props.itemKey)} styles={FLEX_1}>
            <PivotItem headerText="Manual Entry" itemKey="manual" itemIcon="Edit" />
            <PivotItem headerText="Excel Upload"  itemKey="csv"    itemIcon="ExcelDocument" />
          </Pivot>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {importMode === "csv" && (
              <button
                onClick={handleDownloadTemplate}
                title={`Download a pre-filled template with all ${totalUnits} units from your structure`}
                className="on-download-btn"
              >
                <div className="on-download-icon-wrap">
                  <Icon iconName="Download" styles={ICON_GREEN_18} />
                </div>
                <span>Download Excel</span>
                <span className="on-download-units">{totalUnits} units pre-filled</span>
              </button>
            )}
            <button onClick={() => setShowPreview(true)} className="on-preview-btn">
              <Icon iconName="View" styles={ICON_14} />
              Preview Structure
            </button>
          </div>
        </div>

        {/* ── Manual entry ── */}
        {importMode === "manual" && (
          <Stack tokens={{ childrenGap: 12 }}>
            {residents.length === 0 ? (
              <Stack horizontalAlign="center" styles={EMPTY_STATE_WRAPPER} tokens={{ childrenGap: 12 }}>
                <div className="on-empty-icon-wrap">
                  <Icon iconName="People" styles={ICON_BLUE_30} />
                </div>
                <div className="on-empty-text">
                  <div className="on-empty-title">No residents added yet</div>
                  <div className="on-empty-subtitle">
                    Select a unit from your tower structure to get started
                  </div>
                </div>
                <div className="on-empty-btns">
                  <button onClick={() => openAddModal(null)} className="on-add-first-btn">
                    <Icon iconName="Add" styles={ICON_WHITE_13} />
                    Add First Resident
                  </button>
                </div>
              </Stack>
            ) : (
              <Stack tokens={{ childrenGap: 0 }}>
                {/* Resident cards */}
                <div className="on-resident-list">
                  {residents.map((r) => {
                    const hue     = (r.name.charCodeAt(0) * 37) % 360;
                    const isOwner = r.resident_type === "OWNER";
                    return (
                      <div key={r.id} className="on-resident-card">
                        {/* Avatar — background/color are dynamic (hsl from name hue) */}
                        <div
                          className="on-resident-avatar"
                          style={{
                            background: `hsl(${hue},65%,88%)`,
                            color:      `hsl(${hue},55%,35%)`,
                          }}
                        >
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="on-resident-info">
                          <div className="on-resident-name-row">
                            <span className="on-resident-name">{r.name}</span>
                            <span className={`on-resident-badge${isOwner ? " on-resident-badge--owner" : " on-resident-badge--tenant"}`}>
                              {r.resident_type}
                            </span>
                            {r.bhk && <span className="on-resident-bhk">{r.bhk}</span>}
                          </div>
                          <div className="on-resident-details">
                            {/* Location: tower · floor (if known) · unit */}
                            {(() => {
                              const towerName = r.tower || towers[r.tower_idx]?.name;
                              const parts = [
                                towerName,
                                r.floor ? `Floor ${r.floor}` : null,
                                r.unit_number ? `Unit ${r.unit_number}` : null,
                              ].filter(Boolean);
                              return parts.length
                                ? <span className="on-resident-location">{parts.join(" · ")}</span>
                                : null;
                            })()}
                            {r.phone && <span>{r.phone}</span>}
                            {r.email && <span className="on-resident-email">{r.email}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="on-resident-actions">
                          <button
                            onClick={() => openEditModal(r)}
                            title="Edit"
                            className="on-edit-btn"
                          >
                            <Icon iconName="Edit" styles={{ root: { fontSize: 12 } }} />
                          </button>
                          <button
                            onClick={() => removeRow(r.id)}
                            title="Remove"
                            className="on-remove-btn"
                          >×</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => openAddModal(null)} className="on-add-another-btn">
                  <Icon iconName="Add" styles={ICON_13} />
                  Add Another Resident
                </button>
              </Stack>
            )}
          </Stack>
        )}

        {/* ── Excel upload ── */}
        {importMode === "csv" && (
          <Stack tokens={{ childrenGap: 16 }}>
            {/* Drop zone */}
            {!csvPreview && (
              <Stack
                horizontalAlign="center" verticalAlign="center"
                tokens={{ childrenGap: 14 }}
                styles={DROP_ZONE}
                onClick={() => fileRef.current?.click()}
              >
                <Icon iconName="Upload" styles={ICON_UPLOAD_36} />
                <Stack horizontalAlign="center" tokens={{ childrenGap: 4 }}>
                  <Text variant="medium" styles={DROP_ZONE_TITLE}>
                    Click to browse or drag &amp; drop
                  </Text>
                  <Text variant="small" styles={MUTED_TEXT}>
                    .xlsx files only · download the template to get started
                  </Text>
                </Stack>
                <input
                  ref={fileRef} type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: "none" }}
                  onChange={handleCsvFile}
                />
              </Stack>
            )}

            {/* XLSX preview */}
            {csvPreview && (() => {
              const filledCount = csvPreview.filter(
                (r) => (r.resident_name || r.name || "").trim() !== "",
              ).length;
              const emptyCount = csvPreview.length - filledCount;
              return (
              <Stack tokens={{ childrenGap: 12 }}>
                <Stack horizontal verticalAlign="center" horizontalAlign="space-between">
                  <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Icon iconName="CheckMark" styles={ICON_GREEN_16} />
                    <Text variant="medium" styles={PARSED_COUNT}>
                      {filledCount} residents to import
                      {emptyCount > 0 && (
                        <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                          · {emptyCount} empty rows skipped
                        </span>
                      )}
                    </Text>
                  </Stack>
                  <DefaultButton
                    text="Change file" iconProps={{ iconName: "Upload" }}
                    onClick={() => { setCsvPreview(null); setShowAllPreview(false); setEditPreviewIdx(null); fileRef.current.value = ""; }}
                    styles={CHANGE_FILE_BTN}
                  />
                </Stack>
                <div className="on-preview-table-wrap">
                  <table className="on-preview-table">
                    <thead>
                      <tr className="on-preview-thead-row">
                        {XLSX_TABLE_HEADERS.map((h) => (
                          <th key={h} className="on-col-header">{h}</th>
                        ))}
                        <th className="on-col-header on-col-actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllPreview ? csvPreview : csvPreview.slice(0, 8)).map((r, i) => (
                        editPreviewIdx === i ? (
                          /* ── Inline edit row ── */
                          <React.Fragment key={i}>
                          <tr className="on-preview-tbody-row on-preview-editing-row">
                            {XLSX_TABLE_KEYS.map((k) => (
                              <td key={k} className="on-preview-td">
                                <EditCell
                                  fieldKey={k}
                                  value={editPreviewData[k] ?? ""}
                                  onChange={(v) => setEditPreviewData((p) => ({ ...p, [k]: v }))}
                                  towers={towers}
                                  error={editErrors[k]}
                                  rowData={editPreviewData}
                                />
                              </td>
                            ))}
                            <td className="on-preview-td on-preview-actions">
                              <button className="on-preview-save-btn"  onClick={saveEditPreview}   title="Save">✓</button>
                              <button className="on-preview-cancel-btn" onClick={cancelEditPreview} title="Cancel">✗</button>
                            </td>
                          </tr>
                          {Object.keys(editErrors).length > 0 && (
                            <tr className="on-preview-error-row">
                              <td colSpan={XLSX_TABLE_KEYS.length + 1} className="on-preview-error-cell">
                                <div className="on-preview-error-bar">
                                  {Object.values(editErrors).map((msg, ei) => (
                                    <span key={ei} className="on-preview-error-tag">⚠ {msg}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        ) : (
                          /* ── Read row ── */
                          <tr
                            key={i}
                            className={`on-preview-tbody-row${
                              rowErrors[i] && Object.keys(rowErrors[i]).length
                                ? " on-preview-row--warning"
                                : ""
                            }`}
                          >
                            {XLSX_TABLE_KEYS.map((k) => (
                              <td
                                key={k}
                                className={`on-preview-td${rowErrors[i]?.[k] ? " on-preview-td--error" : ""}`}
                                title={rowErrors[i]?.[k] || undefined}
                              >
                                {r[k] || "—"}
                              </td>
                            ))}
                            <td className="on-preview-td on-preview-actions">
                              {rowErrors[i] && Object.keys(rowErrors[i]).length > 0 && (
                                <span
                                  className="on-preview-row-warn"
                                  title={Object.values(rowErrors[i]).join("\n")}
                                >⚠</span>
                              )}
                              <button className="on-preview-row-edit-btn"   onClick={() => startEditPreview(i)} title="Edit"><Icon iconName="Edit"   styles={{ root: { fontSize: 12 } }} /></button>
                              <button className="on-preview-row-delete-btn" onClick={() => deletePreviewRow(i)} title="Delete"><Icon iconName="Delete" styles={{ root: { fontSize: 12 } }} /></button>
                            </td>
                          </tr>
                        )
                      ))}
                      {csvPreview.length > 8 && (
                        <tr>
                          <td colSpan={12} className="on-preview-more">
                            <button
                              className="on-preview-more-btn"
                              onClick={() => setShowAllPreview((v) => !v)}
                            >
                              {showAllPreview
                                ? "▲ Show less"
                                : `▼ Show all ${csvPreview.length - 8} more rows — click to expand`}
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {errorRowCount > 0 && (
                  <MessageBar
                    messageBarType={MessageBarType.warning}
                    styles={{ root: { borderRadius: 6 } }}
                  >
                    <strong>{errorRowCount} row{errorRowCount > 1 ? "s have" : " has"} issues</strong>
                    {" — "}hover the <strong>⚠</strong> icon on a row to see the problem, then click ✎ to fix it.
                    Rows with invalid floor, unit, or phone cannot be imported.
                  </MessageBar>
                )}
                <PrimaryButton
                  text={
                    errorRowCount > 0
                      ? `Fix ${errorRowCount} row${errorRowCount > 1 ? "s" : ""} before importing`
                      : `Confirm Import (${filledCount} residents)`
                  }
                  iconProps={{ iconName: errorRowCount > 0 ? "Warning" : "Accept" }}
                  onClick={confirmCsvImport}
                  disabled={errorRowCount > 0}
                  styles={CONFIRM_IMPORT_BTN}
                />
              </Stack>
              );
            })()}
          </Stack>
        )}

        {error && (
          <MessageBar messageBarType={MessageBarType.error} styles={MSG_BAR_TOP}>
            {error}
          </MessageBar>
        )}

        {/* ── Guard Portal Setup ─────────────────────────────────────────── */}
        <Stack tokens={{ childrenGap: 10 }} styles={{ root: { background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "16px 20px", marginTop: 8 } }}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="Shield" styles={{ root: { color: "#0ea5e9", fontSize: 16 } }} />
            <Text styles={T.sectionHeader}>Guard Portal Setup</Text>
            {existingGuard?.exists && (
              <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 10, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Configured</span>
            )}
          </Stack>
          <Text styles={T.caption}>
            {existingGuard?.exists
              ? `Guard account "${existingGuard.username}" is set up. Update credentials below if needed.`
              : "Create a login for the security guard at the gate. They will use this to verify visitor passes."}
          </Text>
          <form onSubmit={handleSaveGuard}>
            <Stack tokens={{ childrenGap: 10 }}>
              <Stack horizontal tokens={{ childrenGap: 12 }} wrap>
                <Stack.Item grow={1} styles={{ root: { minWidth: 180 } }}>
                  <TextField
                    label="Guard Username"
                    placeholder="e.g. guard_sunrise"
                    value={guardUsername}
                    onChange={(_, v) => { setGuardUsername(v || ""); setGuardSaved(false); }}
                    autoComplete="off"
                  />
                </Stack.Item>
                <Stack.Item grow={1} styles={{ root: { minWidth: 150 } }}>
                  <TextField
                    label="Password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={guardPassword}
                    onChange={(_, v) => { setGuardPassword(v || ""); setGuardSaved(false); }}
                    autoComplete="new-password"
                  />
                </Stack.Item>
                <Stack.Item grow={1} styles={{ root: { minWidth: 150 } }}>
                  <TextField
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter password"
                    value={guardConfirm}
                    onChange={(_, v) => { setGuardConfirm(v || ""); setGuardSaved(false); }}
                    autoComplete="new-password"
                    errorMessage={guardConfirm && guardPassword !== guardConfirm ? "Passwords do not match" : ""}
                  />
                </Stack.Item>
              </Stack>
              {guardError && <MessageBar messageBarType={MessageBarType.error}>{guardError}</MessageBar>}
              {guardSaved && <MessageBar messageBarType={MessageBarType.success}>Guard account saved successfully.</MessageBar>}
              <Stack horizontal>
                <DefaultButton
                  type="submit"
                  text={guardLoading ? "Saving…" : existingGuard?.exists ? "Update Guard Account" : "Save Guard Account"}
                  iconProps={{ iconName: "Shield" }}
                  disabled={guardLoading || !guardUsername.trim() || !guardPassword || guardPassword !== guardConfirm}
                />
              </Stack>
            </Stack>
          </form>
        </Stack>

        <Stack
          horizontal verticalAlign="center" horizontalAlign="space-between"
          styles={STEP_FOOTER}
        >
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="People" styles={ICON_BLUE} />
            <Text variant="small" styles={SECONDARY_TEXT}>
              {residents.length} resident{residents.length !== 1 ? "s" : ""} ready to import
            </Text>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <DefaultButton text="Back" iconProps={{ iconName: "ChevronLeft" }} onClick={onBack}
              styles={BACK_BTN} />
            <PrimaryButton
              text={residents.length === 0 ? "Skip & Finish" : "Finish & Import"}
              iconProps={{ iconName: "Accept" }}
              onClick={onFinish} disabled={loading}
              styles={PRIMARY_BTN}
            >
              {loading && <Spinner size={SpinnerSize.small} styles={SPINNER_INLINE} />}
            </PrimaryButton>
          </Stack>
        </Stack>
      </Stack>
    </>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

const SUCCESS_STATS = [
  { icon: "GridViewSmall",    label: "Units Created"   },
  { icon: "People",   label: "Residents Added" },
  { icon: "CityNext", label: "Towers"          },
];

function SuccessScreen({ society, totalUnits, totalResidents, navigate, secretaryCreds, onResetCreds, resetCredsLoading }) {
  const statValues = [totalUnits, totalResidents, society?.num_towers || 1];

  return (
    <Stack
      horizontalAlign="center" verticalAlign="center"
      tokens={{ childrenGap: 24 }}
      styles={SUCCESS_OUTER}
    >
      <Stack horizontalAlign="center" verticalAlign="center" styles={SUCCESS_ICON_CIRCLE}>
        <Icon iconName="CheckMark" styles={ICON_SUCCESS_44} />
      </Stack>

      <Stack horizontalAlign="center" tokens={{ childrenGap: 8 }}>
        <Text styles={T.pageHeader}>Onboarding Complete!</Text>
        <Text styles={SUCCESS_SUBTITLE}>
          {society?.name} has been successfully set up with all its units and residents.
        </Text>
      </Stack>

      {/* Building ID badge */}
      <Stack styles={BUILDING_ID_BADGE} horizontalAlign="center" tokens={{ childrenGap: 4 }}>
        <Text variant="xSmall" styles={BUILDING_ID_LABEL}>
          BUILDING ID / LOGIN USERNAME
        </Text>
        <Text styles={BUILDING_ID_VALUE}>
          {society?.building_id}
        </Text>
      </Stack>

      {/* Stats */}
      <Stack horizontal tokens={{ childrenGap: 24 }}>
        {SUCCESS_STATS.map((s, i) => (
          <Stack key={s.label} horizontalAlign="center" tokens={{ childrenGap: 4 }}>
            <Stack horizontalAlign="center" verticalAlign="center" styles={STAT_ICON_WRAP}>
              <Icon iconName={s.icon} styles={ICON_SUCCESS_24} />
            </Stack>
            <Text styles={STAT_VALUE}>{statValues[i]}</Text>
            <Text styles={T.caption}>{s.label}</Text>
          </Stack>
        ))}
      </Stack>

      {/* Secretary credentials — show step-1 password directly; reset available if needed */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a",
        borderRadius: 10, padding: "14px 18px", maxWidth: 420, width: "100%",
      }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e", marginBottom: 8 }}>
          🔑  Secretary Login
        </div>
        {secretaryCreds ? (
          <CredentialsBox username={secretaryCreds.username} password={secretaryCreds.tempPassword} />
        ) : (
          <div style={{ fontSize: 12, color: "#78350f" }}>
            Username: <strong style={{ fontFamily: "monospace" }}>{society?.building_id}</strong>
            <br />
            Password was set during society creation. Use "Reset Password" to generate a new one.
          </div>
        )}
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <DefaultButton
            text={resetCredsLoading ? "Generating…" : "Reset Password"}
            iconProps={{ iconName: "Permissions" }}
            disabled={resetCredsLoading}
            onClick={onResetCreds}
          />
        </div>
      </div>

      <PrimaryButton text="Go to Onboarding" iconProps={{ iconName: "Back" }}
        onClick={() => navigate("/onboarding")}
        styles={PRIMARY_BTN}
      />
    </Stack>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnboardingNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlSocietyId = searchParams.get("societyId") || null;
  // URL step param is 1-indexed (step=2 → unit structure); convert to 0-indexed
  const urlStep = Math.max(0, Math.min(2, Number(searchParams.get("step") || 1) - 1));

  const [currentStep,     setCurrentStep    ] = useState(urlSocietyId ? urlStep : 0);
  const [loading,         setLoading        ] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!urlSocietyId);
  const [error,           setError          ] = useState(null);
  const [societyId,       setSocietyId      ] = useState(urlSocietyId);
  const [createdSociety,  setCreatedSociety ] = useState(null);
  const [done,            setDone           ] = useState(false);
  const [doneStats,       setDoneStats      ] = useState({ units: 0, residents: 0 });
  const [secretaryCreds,  setSecretaryCreds ] = useState(null); // { username, tempPassword }
  // Modal: shown right after Step 1 creates a new society; must be dismissed to proceed
  const [credsModalOpen,  setCredsModalOpen ] = useState(false);
  // Reset creds modal: shown from success screen / society detail
  const [resetCredsLoading, setResetCredsLoading] = useState(false);

  const [buildingForm,    setBuildingForm   ] = useState(BUILDING_FORM_DEFAULTS);
  const [step1FieldErrors, setStep1FieldErrors] = useState({});
  const [towers,          setTowers         ] = useState(() => initTowers(2, 5, 4));
  const [residents,       setResidents      ] = useState([]);

  // Suppress tower re-seeding when we load data from the API
  const skipTowerSeed = useRef(false);

  useEffect(() => {
    if (skipTowerSeed.current) { skipTowerSeed.current = false; return; }
    setTowers(initTowers(
      Number(buildingForm.num_towers) || 1,
      Number(buildingForm.num_floors) || 1,
      Number(buildingForm.num_units)  || 4,
    ));
  }, [buildingForm.num_towers, buildingForm.num_floors, buildingForm.num_units]);

  // Load existing society when continuing from the onboarding list
  useEffect(() => {
    if (!urlSocietyId) return;
    (async () => {
      try {
        setLoadingExisting(true);
        const { society, towers: existingTowers } = await api.onboarding.getSociety(urlSocietyId);

        skipTowerSeed.current = true;
        setBuildingForm({
          name:           society.name           || "",
          address:        society.address         || "",
          society_type:   society.society_type    || "APARTMENT",
          num_towers:     society.num_towers      || 2,
          num_floors:     society.num_floors      || 5,
          num_units:      society.num_units       || 4,
          contact_person: society.contact_person  || "",
          contact_phone:  society.contact_phone   || "",
          contact_email:  society.contact_email   || "",
        });
        setCreatedSociety(society);

        if (existingTowers?.length) {
          setTowers(existingTowers.map((t) => ({
            name:   t.name,
            floors: (t.floors || []).map((f) => ({
              floor_number: f.floor_number,
              units:        (f.units || []).map((u) => u.unit_number),
            })),
          })));
        }
      } catch {
        setError("Failed to load society details. You can still continue.");
      } finally {
        setLoadingExisting(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSocietyId]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleStep1Next = async () => {
    if (!buildingForm.name?.trim()) return;

    // Field-level validation (phone + email are optional but must be valid if filled)
    const errs = {};
    const phoneErr = validatePhone(buildingForm.contact_phone);
    const emailErr = validateEmail(buildingForm.contact_email);
    if (phoneErr) errs.contact_phone = phoneErr;
    if (emailErr) errs.contact_email = emailErr;
    if (Object.keys(errs).length) { setStep1FieldErrors(errs); return; }
    setStep1FieldErrors({});

    setLoading(true); setError(null);
    try {
      const data = societyId
        ? await api.onboarding.updateSociety(societyId, buildingForm)
        : await api.onboarding.createSociety(buildingForm);
      setSocietyId(data.society.id);
      setCreatedSociety(data.society);
      if (data.secretaryCredentials) {
        // New society — show the credentials modal BEFORE advancing to Step 2
        setSecretaryCreds(data.secretaryCredentials);
        setCredsModalOpen(true);
        // setCurrentStep(1) is called when user dismisses the modal
      } else {
        // Editing existing society — just advance
        setCurrentStep(1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Next = async () => {
    if (!societyId) return;
    setLoading(true); setError(null);
    try {
      const towersPayload = towers.map((t) => ({
        name:   t.name,
        floors: t.floors.map((f) => ({ floor_number: f.floor_number, units: f.units })),
      }));
      const data = await api.onboarding.saveStructure(societyId, towersPayload);
      setDoneStats((s) => ({ ...s, units: data.total_units }));
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!societyId) return;
    setLoading(true); setError(null);
    try {
      let importedCount = 0;
      if (residents.length > 0) {
        // Attach the tower name so the backend can do a precise unit lookup
        const residentsWithTower = residents.map((r) => ({
          ...r,
          tower: towers[r.tower_idx]?.name || "",
        }));
        const data = await api.onboarding.importResidents(societyId, residentsWithTower);
        importedCount = data.imported;
      }
      // Always derive unit count from the live towers state so the success
      // screen is correct even when step 2 was completed in a previous session
      // (resume flow) and handleStep2Next was never called this session.
      setDoneStats({ units: countTotalUnits(towers), residents: importedCount });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Reset secretary password ──────────────────────────────────────────────

  const handleResetSecretaryCreds = async () => {
    if (!societyId) return;
    setResetCredsLoading(true);
    try {
      const data = await api.onboarding.resetSecretaryPassword(societyId);
      if (data.secretaryCredentials) {
        setSecretaryCreds(data.secretaryCredentials);
        setCredsModalOpen(true);
      }
    } catch { /* ignore */ } finally {
      setResetCredsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEditing = !!urlSocietyId;

  if (loadingExisting) {
    return (
      <Stack horizontalAlign="center" styles={LOADING_WRAP}>
        <Spinner size={SpinnerSize.large} label="Loading society details…" />
      </Stack>
    );
  }

  const societyTypeLabel = createdSociety?.society_type
    ?.replace("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Society";

  return (
    <Stack tokens={{ childrenGap: 0 }}>
      {/* Hero header */}
      {!done && (
        <div className="on-hero">
          {/* Decorative blobs */}
          <div className="on-hero-blob-1" />
          <div className="on-hero-blob-2" />

          <div className="on-hero-content">
            {/* Top row: back + badges */}
            <div className="on-hero-toprow">
              <button
                onClick={() => navigate("/onboarding")}
                title="Back to Onboarding"
                className="on-hero-back-btn"
              >
                <Icon iconName="Back" styles={ICON_BACK} />
              </button>

              {isEditing && createdSociety?.building_id && (
                <div className="on-hero-id-pill">{createdSociety.building_id}</div>
              )}

              <div className="on-hero-type-badge">
                <Icon iconName={isEditing ? "CityNext" : "Add"} styles={ICON_12} />
                {isEditing ? societyTypeLabel : "New Society"}
              </div>

              <div className="on-hero-step-badge">
                <div className="on-hero-step-dot" />
                Step {currentStep + 1} of 3
              </div>
            </div>

            <div className="on-hero-title">
              {isEditing ? (createdSociety?.name || "Society") : "Add New Society"}
            </div>
            <div className="on-hero-subtitle">
              {isEditing
                ? `Picking up from Step ${currentStep + 1} · Building ID: ${createdSociety?.building_id || "—"}`
                : "Set up your building in 3 simple steps"}
            </div>
          </div>
        </div>
      )}

      {done ? (
        <SuccessScreen
          society={createdSociety}
          totalUnits={doneStats.units}
          totalResidents={doneStats.residents}
          navigate={navigate}
          secretaryCreds={secretaryCreds}
          onResetCreds={handleResetSecretaryCreds}
          resetCredsLoading={resetCredsLoading}
        />
      ) : (
        <>
          <Stepper current={currentStep} />
          <Stack styles={MAIN_CARD}>
            {currentStep === 0 && (
              <Step1 form={buildingForm} setForm={setBuildingForm} onNext={handleStep1Next} loading={loading} error={error} fieldErrors={step1FieldErrors} />
            )}
            {currentStep === 1 && (
              <Step2 towers={towers} setTowers={setTowers} onBack={() => setCurrentStep(0)} onNext={handleStep2Next} loading={loading} error={error} />
            )}
            {currentStep === 2 && (
              <Step3 societyId={societyId} towers={towers} residents={residents} setResidents={setResidents} onBack={() => setCurrentStep(1)} onFinish={handleFinish} loading={loading} error={error} />
            )}
          </Stack>
        </>
      )}

      {/* ── Secretary Credentials Modal ──────────────────────────────────── */}
      {/* Shown immediately after a new society is created (Step 1 POST).    */}
      {/* User MUST dismiss it — clicking the button advances to Step 2.     */}
      <SecretaryCredsModal
        isOpen={credsModalOpen}
        creds={secretaryCreds}
        isReset={!!done}
        onDismiss={() => {
          setCredsModalOpen(false);
          if (!done) setCurrentStep(1); // only advance during wizard, not from success screen
        }}
      />
    </Stack>
  );
}

// ── SecretaryCredsModal ───────────────────────────────────────────────────────

function SecretaryCredsModal({ isOpen, creds, isReset, onDismiss }) {
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    const text = `Nexso Secretary Login\nUsername: ${creds?.username}\nPassword: ${creds?.tempPassword}\nNote: Must change password on first login.`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={onDismiss}
      dialogContentProps={{
        type:  DialogType.normal,
        title: isReset ? "🔑  New Secretary Credentials" : "🔑  Secretary Login Created",
      }}
      modalProps={{ isBlocking: true }}
      minWidth={460}
    >
      <div style={{ marginBottom: 12, fontSize: 14, color: "#475569" }}>
        {isReset
          ? "A new temporary password has been generated. Share these with the society secretary."
          : "A secretary account has been created for this society. Note down these credentials before continuing — the password cannot be retrieved again."}
      </div>

      {/* Credentials box */}
      <CredentialsBox username={creds?.username} password={creds?.tempPassword} />

      <div style={{ marginTop: 10, fontSize: 12, color: "#16a34a" }}>
        ⚠️  The secretary will be asked to change this password on first login.
      </div>

      <DialogFooter>
        <PrimaryButton
          text={isReset ? "Done" : "I've saved the credentials — Continue"}
          onClick={onDismiss}
          iconProps={{ iconName: "CheckMark" }}
        />
        <DefaultButton
          text={copied ? "✓ Copied!" : "Copy to clipboard"}
          onClick={copy}
          iconProps={{ iconName: "Copy" }}
        />
      </DialogFooter>
    </Dialog>
  );
}
