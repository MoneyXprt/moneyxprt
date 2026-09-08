import type { Section179TaxConstants } from './types';

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
  taxConstants: Section179TaxConstants;
}

/** Returns the uncapped business-use basis for one non-vehicle equipment asset. */
export function getEquipmentRequestedDeduction(asset: Section179EquipmentAssetInput): number {
  return asset.purchasePrice * (asset.businessUsePercent / 100);
}

/** Returns whether an asset was placed in service in the active tax year. */
export function isSection179AssetInTaxYear(
  asset: Section179EquipmentAssetInput,
  taxYear: number,
): boolean {
  return new Date(asset.placedInServiceDate).getUTCFullYear() === taxYear;
}

/** Allocates the single annual Section 179 allowance proportionally across property types. */
export function allocateSection179Deduction(input: Section179AllocationInput): Section179Allocation {
  const { taxConstants } = input;
  const qualifyingEquipmentAssets = input.equipmentAssets.filter(
    asset => isSection179AssetInTaxYear(asset, taxConstants.taxYear),
  );
  const vehicleRequested = Math.min(
    input.vehiclePurchasePrice * (input.vehicleBusinessUsePercent / 100),
    taxConstants.heavyVehicleCap,
  );
  const equipmentRequested = qualifyingEquipmentAssets.reduce(
    (total, asset) => total + getEquipmentRequestedDeduction(asset),
    0,
  );
  const requestedDeduction = vehicleRequested + equipmentRequested;
  const totalPropertyBasis =
    input.vehiclePurchasePrice * (input.vehicleBusinessUsePercent / 100) + equipmentRequested;
  const phaseOutReduction = Math.max(0, totalPropertyBasis - taxConstants.phaseOutThreshold);
  const annualAllowance = totalPropertyBasis >= taxConstants.completePhaseOut
    ? 0
    : Math.max(0, taxConstants.maxDeduction - phaseOutReduction);
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
