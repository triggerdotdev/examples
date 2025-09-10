// Trigger.dev task types for proper TypeScript support

export interface TaskProgress {
  step: number;
  total: number;
  message: string;
}

export interface ProductAnalysis {
  exact_product_name: string;
  model_number: string;
  material: string;
  colors: string[];
  shape: string;
  size_proportions: string;
  functional_elements: string[];
  surface_finish: string;
  text_branding: string;
  unique_features: string[];
  product_category: string;
}

export interface UploadTaskOutput {
  success: boolean;
  bucket?: string;
  r2Key: string;
  publicUrl: string;
  fileSize: number;
  contentType: string;
  fileName: string;
  productAnalysis: ProductAnalysis;
}

export interface UploadTaskMetadata {
  status?: string;
  progress?: TaskProgress;
  result?: {
    publicUrl: string;
    r2Key: string;
    fileSize: number;
    fileName: string;
    productAnalysis: ProductAnalysis;
  };
  error?: string;
}

export interface GenerationTaskOutput {
  success: boolean;
  imageUrl: string;
  prompt: string;
  model: string;
  size: string;
  publicUrl?: string;
}

export interface GenerationTaskMetadata {
  status?: string;
  progress?: TaskProgress;
  error?: string;
}
