import type { UploadMetadata, AssetAcceptResult } from '../asset';

export interface FieldError {
  field: string;
  message: string;
}

export type NormalizedAssetUpload = {
  deviceId: string;
  familyId: string;
  ownerId: string;
  metadata: UploadMetadata;
  content: Buffer;
  receivedAt: Date;
};

export type AssetRejectCode =
  | 'INVALID_METADATA'
  | 'TIME_DRIFT_EXCEEDED'
  | 'ASSET_CONTENT_CONFLICT'
  | 'DEVICE_CREDENTIAL_MISMATCH';

export type AssetIngressAccept =
  | { status: 'accepted'; result: AssetAcceptResult }
  | { status: 'rejected'; code: AssetRejectCode; fields?: FieldError[] };

export interface AssetIngressPort {
  readonly source: 'direct' | 'cloud_relay';
  accept(input: NormalizedAssetUpload): Promise<AssetIngressAccept>;
}