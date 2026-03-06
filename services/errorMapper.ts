import { PostgrestError } from '@supabase/supabase-js';

export interface AppError {
  message: string;
  code: string;
  originalError?: any;
}

export const mapSupabaseError = (error: any): AppError => {
  // Handle specific Postgres error codes
  if (error?.code === '42P01') {
    return {
      message: "Database Error: Table not found. Please run the SQL schema script.",
      code: 'TABLE_NOT_FOUND',
      originalError: error
    };
  }

  if (error?.code === '23505') {
    return {
      message: "This record already exists.",
      code: 'DUPLICATE_ENTRY',
      originalError: error
    };
  }

  if (error?.code === 'PGRST116') {
    return {
      message: "No data found.",
      code: 'NO_DATA_FOUND',
      originalError: error
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      originalError: error
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    if (error === '{}' || !error.trim()) {
      return {
        message: "An unexpected error occurred. Please try again.",
        code: 'UNKNOWN_ERROR',
        originalError: error
      };
    }
    return {
      message: error,
      code: 'UNKNOWN_ERROR',
      originalError: error
    };
  }

  // Check for empty object
  if (typeof error === 'object' && error !== null && Object.keys(error).length === 0) {
    return {
      message: "An unexpected error occurred. Please check your connection.",
      code: 'UNKNOWN_ERROR',
      originalError: error
    };
  }

  // Fallback
  const message = error?.message || error?.error_description || "An unexpected error occurred";
  
  // Handle case where message is "{}" string
  if (message === '{}') {
      return {
        message: "An unexpected error occurred. Please try again.",
        code: error?.code || 'UNKNOWN_ERROR',
        originalError: error
      };
  }

  return {
    message: message,
    code: error?.code || 'UNKNOWN_ERROR',
    originalError: error
  };
};

export const isTableNotFoundError = (error: any): boolean => {
  return error?.code === '42P01' || error?.code === 'TABLE_NOT_FOUND';
};
