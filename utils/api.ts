
export async function safeJsonParse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON but got ${contentType || 'unknown'}. Response starts with: ${text.slice(0, 100)}`);
  }

  try {
    return await response.json();
  } catch (error) {
    const text = await response.text();
    throw new Error(`Failed to parse JSON response. Error: ${error instanceof Error ? error.message : String(error)}. Response starts with: ${text.slice(0, 100)}`);
  }
}

export async function handleApiResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch (e) {
      errorData = { error: errorText.slice(0, 100) };
    }
    throw new Error(`API error (${response.status}): ${errorData.error || errorData.details || response.statusText}`);
  }

  return safeJsonParse(response);
}
