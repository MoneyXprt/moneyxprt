import {
  SECTION_179_HEAVY_VEHICLE_CAP_2026,
  SECTION_179_OVERALL_CAP_2026,
  SECTION_179_PHASE_OUT_THRESHOLD_2026,
  TAX_YEAR,
} from './taxConstants2026';

export interface Section179EquipmentAssetInput {
  description: string;
  purchasePrice: number;
  businessUsePercent: number;
  placedInServiceDate: string;
}

export interface Section179Allocation {
  vehicleDeduction: number;
  equipmentDeduction: number;
  qualifyingEquipmentCount: number;
  requestedDeduction: number;
  allowedDeduction: number;
  phaseOutReduction: number;
}

interface Section179AllocationInput {
  vehiclePurchasePrice: number;
  vehicleBusinessUsePercent: number;
  equipmentAssets: readonly Section179EquipmentAssetInput[];
}

/** Returns the uncapped business-use basis for one non-vehicle equipment asset. */
export function getEquipmentRequestedDeduction(asset: Section179EquipmentAssetInput): number {
  return asset.purchasePrice * (asset.businessUsePercent / 100);
}

/** Returns whether an asset was placed in service in the active tax year. */
export function isSection179AssetInTaxYear(asset: Section179EquipmentAssetInput): boolean {
  return new Date(asset.placedInServiceDate).getUTCFullYear() === TAX_YEAR;
}

/** Allocates the single annual Section 179 allowance proportionally across property types. */
export function allocateSection179Deduction(input: Section179AllocationInput): Section179Allocation {
  const qualifyingEquipmentAssets = input.equipmentAssets.filter(isSection179AssetInTaxYear);
  const vehicleRequested = Math.min(
    input.vehiclePurchasePrice * (input.vehicleBusinessUsePercent / 100),
    SECTION_179_HEAVY_VEHICLE_CAP_2026,
  );
  const equipmentRequested = qualifyingEquipmentAssets.reduce(
    (total, asset) => total + getEquipmentRequestedDeduction(asset),
    0,
  );
  const requestedDeduction = vehicleRequested + equipmentRequested;
  const totalPropertyBasis =
    input.vehiclePurchasePrice * (input.vehicleBusinessUsePercent / 100) + equipmentRequested;
  const phaseOutReduction = Math.max(0, totalPropertyBasis - SECTION_179_PHASE_OUT_THRESHOLD_2026);
  const annualAllowance = Math.max(0, SECTION_179_OVERALL_CAP_2026 - phaseOutReduction);
  const allowedDeduction = Math.min(requestedDeduction, annualAllowance);
  const vehicleDeduction = requestedDeduction > 0
    ? allowedDeduction * (vehicleRequested / requestedDeduction)
    : 0;

  return {
    vehicleDeduction,
    equipmentDeduction: allowedDeduction - vehicleDeduction,
    qualifyingEquipmentCount: qualifyingEquipmentAssets.length,
    requestedDeduction,
    allowedDeduction,
    phaseOutReduction,
  };
}
