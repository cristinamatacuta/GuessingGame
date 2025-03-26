

export const KEY = import.meta.env.VITE_AZURE_KEY;
export const NLU_KEY = import.meta.env.VITE_AZURE_KEY;


console.log("🔍 Vercel Debug - API Key:", "Length:", VITE_NLU_KEY ? VITE_NLU_KEY.length : "undefined");
console.log("🔍 Vercel Debug - API Endpoint:", azureLanguageCredentials.endpoint);

