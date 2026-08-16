// The pipeline's failure taxonomy.

/** Pipeline error types */
export type PipelineErrorType = 'non_food_input' | 'api_error' | 'parse_error';

export interface PipelineError {
  type: PipelineErrorType;
  message: string;
  retryable: boolean;
}
