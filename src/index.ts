#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"; // Use lower-level Server
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema'; // Import zodToJsonSchema
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

// Environment variables are expected to be passed via mcp_settings.json's "env"
// console.log("[INFO] Reading environment variables from process.env (expected from MCP client)..."); // Log can be added if needed

// --- 1. Gemini API Client Setup ---
// Ensure GEMINI_API_KEY is passed via environment variables (e.g., from mcp_settings.json)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // Updated error message to reflect expectation
  console.error("Error: GEMINI_API_KEY environment variable is not set. Please configure it in your MCP client settings (e.g., mcp_settings.json).");
  process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);
// Choose the model based on environment variable or default to gemini-1.5-pro
const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash"; // Changed default model
console.error(`[INFO] Using Gemini model: ${modelName}`);
const geminiModel = genAI.getGenerativeModel({ model: modelName });

// --- 2. MCP Server Setup (using lower-level Server) ---
const server = new Server(
  {
    name: "youtube-vision-mcp-server",
    version: "0.1.0", // Initial version
  },
  {
    capabilities: {
      tools: {}, // Indicate tool capability
    },
  }
);

// --- 3a. Input Schema for summarize_youtube_video ---
const SummaryLengthEnum = z.enum(['short', 'medium', 'long']).default('medium');
const SummarizeYoutubeVideoInputSchema = z.object({
  youtube_url: z.string().url({ message: "Invalid YouTube URL provided." }),
  summary_length: SummaryLengthEnum.optional().describe("Desired summary length: 'short', 'medium', or 'long' (default: 'medium')."),
});

// --- 3b. Input Schema for ask_about_youtube_video ---
const AskAboutYoutubeVideoInputSchema = z.object({
  youtube_url: z.string().url({ message: "Invalid YouTube URL provided." }),
  // Making question optional to handle general description requests as well
  question: z.string().optional().describe("Question about the video content. If omitted, a general description will be generated."),
});

// --- 3c. Input Schema for extract_key_moments ---
const ExtractKeyMomentsInputSchema = z.object({
  youtube_url: z.string().url({ message: "Invalid YouTube URL provided." }),
  number_of_moments: z.number().int().positive().optional().default(3).describe("Number of key moments to extract (default: 3)."),
});


// --- 3d. ListTools Handler ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Replaced describe_youtube_video with summarize_youtube_video
      {
        name: "summarize_youtube_video",
        description: "Generates a summary of a given YouTube video URL using Gemini Vision API.",
        inputSchema: zodToJsonSchema(SummarizeYoutubeVideoInputSchema),
      },
      // Moved list_supported_models to the end
      {
        name: "ask_about_youtube_video",
        description: "Answers a question about the video or provides a general description if no question is asked.",
        inputSchema: zodToJsonSchema(AskAboutYoutubeVideoInputSchema), // Schema updated to make question optional
      },
      {
        name: "extract_key_moments",
        description: "Extracts key moments (timestamps and descriptions) from a given YouTube video.",
        inputSchema: zodToJsonSchema(ExtractKeyMomentsInputSchema),
      },
      {
        name: "list_supported_models",
        description: "Lists available Gemini models that support the 'generateContent' method.",
        inputSchema: zodToJsonSchema(z.object({})), // No input needed
      },
    ],
  };
});

// --- Helper function for calling Gemini API ---
async function callGeminiApi(prompt: string, fileData: { mimeType: string; fileUri: string }): Promise<string> {
  try {
    const result = await geminiModel.generateContent([
      prompt,
      { fileData },
    ]);
    const response = result.response;
    return response.text();
  } catch (error: any) {
    console.error(`[ERROR] Gemini API call failed:`, error);
    // Attempt to provide more specific error info based on message content
    // (Since GoogleGenerativeAIError type seems unavailable for direct check)
    if (error instanceof Error) {
      // Check for common messages indicating client-side issues (API key, quota, etc.)
      // This part might need refinement based on actual observed error messages.
      if (error.message.includes('API key') || error.message.includes('permission denied')) {
         throw new Error(`Authentication/Authorization Error with Gemini API: ${error.message}`);
      } else if (error.message.includes('quota')) {
         throw new Error(`Gemini API quota likely exceeded: ${error.message}`);
      } else if (error.message.toLowerCase().includes('invalid')) { // Generic check for invalid inputs
         throw new Error(`Invalid input likely provided to Gemini API: ${error.message}`);
      } else if (error.message.includes('500') || error.message.includes('server error') || error.message.includes('network issue')) {
         // Guessing based on common error patterns for server/network issues
         throw new Error(`Gemini API server error or network issue: ${error.message}`);
      }
      // Re-throw generic error if specific checks don't match
      throw new Error(`Gemini API Error: ${error.message}`);
    }
    // Re-throw if it's not an Error instance for some reason
    throw error; // Keep original error if not an Error instance
  }
}

// --- CallTool Handler ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!request.params.arguments) {
    throw new Error("Arguments are required for tool call.");
  }

  switch (request.params.name) {
    // Removed describe_youtube_video case, replaced by summarize_youtube_video
    case "summarize_youtube_video": {
       try {
         // Parse and validate arguments
         const args = SummarizeYoutubeVideoInputSchema.parse(request.params.arguments);
         const { youtube_url, summary_length } = args;
         const length = summary_length || 'medium'; // Use default if not provided

         console.error(`[INFO] Received request to summarize YouTube URL: ${youtube_url} (Length: ${length})`);

         // Construct the prompt for Gemini API
         const finalPrompt = `Please summarize this video. Aim for a ${length} length summary.`;

         // Call Gemini API using the helper function
         const summary = await callGeminiApi(finalPrompt, {
           mimeType: "video/youtube",
           fileUri: youtube_url,
         });

         console.error(`[INFO] Successfully generated summary.`);
         // Return success response
         return {
           content: [{ type: "text", text: summary }],
         };

       } catch (error: any) {
         console.error(`[ERROR] Failed during summarize_youtube_video tool execution:`, error);

         // Handle Zod validation errors
         if (error instanceof z.ZodError) {
           return {
             content: [{ type: "text", text: `Invalid input: ${JSON.stringify(error.errors)}` }],
             isError: true,
           };
         }

         // Handle generic errors
         let errorMessage = `Failed to generate summary for the video.`;
         if (error.message) {
           errorMessage += ` Details: ${error.message}`;
         }
         return {
           content: [{ type: "text", text: errorMessage }],
           isError: true,
         };
       }
     }
  // Removed extra closing brace here
  case "list_supported_models": {
      try {
        console.error(`[INFO] Received request to list supported models.`);

        // Call the Gemini REST API to list models
        const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(listModelsUrl);

        if (!response.ok) {
          let errorDetail = await response.text();
          let errorMessage = `Failed to fetch models from API (${response.status} ${response.statusText}).`;
          switch (response.status) {
            case 401:
            case 403:
              errorMessage = `Invalid API Key or permission denied for model listing.`;
              break;
            case 404:
              errorMessage = `Model listing API endpoint not found.`;
              break;
            case 429:
              errorMessage = `API quota exceeded for model listing.`;
              break;
            default:
              if (response.status >= 400 && response.status < 500) {
                errorMessage = `Invalid request to model listing API (${response.status}).`;
              } else if (response.status >= 500) {
                 errorMessage = `Gemini API server error during model listing (${response.status}).`;
              }
          }
          throw new Error(`${errorMessage} Details: ${errorDetail}`);
        }

        const data = await response.json();

        // Ensure data.models is an array before filtering
        const allModels: any[] = Array.isArray(data?.models) ? data.models : [];

        const supportedModels = allModels
          .filter(model => model.supportedGenerationMethods?.includes('generateContent'))
          .map(model => model.name);

        console.error(`[INFO] Found ${supportedModels.length} models supporting generateContent via REST API.`);

        if (supportedModels.length === 0) {
           return {
             content: [{ type: "text", text: "No models found supporting 'generateContent' via REST API." }],
           };
        }

        return {
          content: [{ type: "text", text: `Models supporting 'generateContent' (fetched via REST API):\n- ${supportedModels.join('\n- ')}` }],
        };

      } catch (error: any) {
        // Catch errors from fetch itself or the re-thrown error from response check
        console.error(`[ERROR] Failed during list_supported_models tool execution:`, error);
        let errorMessage = `Failed to list supported models.`; // Default message
        if (error.message) {
          errorMessage += ` Details: ${error.message}`;
        }
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }
    }
  // Removed extra closing brace here
  case "ask_about_youtube_video": {
    // Define question variable outside try block to access in catch
    let question: string | undefined;
    try {
      // Parse and validate arguments
      const args = AskAboutYoutubeVideoInputSchema.parse(request.params.arguments);
      const { youtube_url } = args;
      question = args.question; // Assign parsed question here

        console.error(`[INFO] Received request for ask_about_youtube_video: ${youtube_url}`);

        let finalPrompt: string;
        if (question) {
          // If a question is provided, use the Q&A prompt
          console.error(`[INFO] Question: "${question}"`);
          finalPrompt = `Please answer the following question based on the provided video content:\n\nQuestion: ${question}`;
        } else {
          // If no question, use a general description prompt
          console.error(`[INFO] No question provided, generating general description.`);
          finalPrompt = "Describe this video content in detail.";
        }

        // Call Gemini API using the helper function
        const answerOrDescription = await callGeminiApi(finalPrompt, {
          mimeType: "video/youtube",
          fileUri: youtube_url,
        });

        console.error(`[INFO] Successfully generated response (answer or description).`);
        // Return success response
        return {
          content: [{ type: "text", text: answerOrDescription }],
        };

      } catch (error: any) {
        console.error(`[ERROR] Failed during ask_about_youtube_video tool execution:`, error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          return {
            content: [{ type: "text", text: `Invalid input: ${JSON.stringify(error.errors)}` }],
            isError: true,
          };
        }

        // Handle generic errors
        let errorMessage = question ? `Failed to answer the question based on the video.` : `Failed to generate description for the video.`;
        if (error.message) {
          errorMessage += ` Details: ${error.message}`;
        }
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }
    }
  // Removed the extra closing brace that was here
  case "extract_key_moments": {
      try {
        // Parse and validate arguments
        const args = ExtractKeyMomentsInputSchema.parse(request.params.arguments);
        const { youtube_url, number_of_moments } = args;

        console.error(`[INFO] Received request to extract ${number_of_moments} key moments from YouTube URL: ${youtube_url}`);

        // Construct the prompt for Gemini API
        const finalPrompt = `Please extract ${number_of_moments} key moments from this video. For each moment, provide the timestamp in MM:SS format and a brief description.`;

        // Call Gemini API using the helper function
        const moments = await callGeminiApi(finalPrompt, {
          mimeType: "video/youtube",
          fileUri: youtube_url,
        });

        console.error(`[INFO] Successfully received raw key moments text from API.`);

        // Parse the raw text into a structured JSON array
        const structuredMoments: { timestamp: string; description: string }[] = [];
        // Simpler Regex to capture timestamp (group 1) and the rest (group 2)
        const momentRegex = /(\d{1,2}:\d{2})\s*[-–—]?\s*(.*)/; // Removed 'g' flag, process line by line
        
        // Split the response into lines and process each line
        const lines = moments.split('\n');
        for (const line of lines) {
          const match = line.trim().match(momentRegex);
          if (match && match[2]) { // Check if match and description part exist
            let description = match[2].trim();
            // Explicitly check for the prefix and remove using substring
            if (description.startsWith('** - ')) {
              description = description.substring(5); // Remove the first 5 characters "** - "
            } else if (description.startsWith('- ')) { // Also handle just "- "
               description = description.substring(2);
            }
            
            structuredMoments.push({
              timestamp: match[1], // Captured "MM:SS"
              description: description // Cleaned description
            });
          } else if (line.trim().length > 0) {
             // Handle lines that might not match the exact format but contain text
             // Option 1: Add as description without timestamp
             // structuredMoments.push({ timestamp: "N/A", description: line.trim() });
             // Option 2: Log a warning and potentially skip
             console.warn(`[WARN] Could not parse line in key moments response: "${line.trim()}"`);
          }
        }

        if (structuredMoments.length === 0 && moments.trim().length > 0) {
           console.warn("[WARN] Failed to parse any structured moments, returning raw text instead.");
           // Fallback to returning raw text if parsing completely fails but text exists
           return {
             content: [{ type: "text", text: moments }],
           };
        }
        
        console.log(`[INFO] Parsed ${structuredMoments.length} key moments.`);
        // Return success response with JSON stringified array
        return {
          // Content type is still text, but the content is a JSON string
          content: [{ type: "text", text: JSON.stringify(structuredMoments, null, 2) }],
        };

      } catch (error: any) {
        console.error(`[ERROR] Failed during extract_key_moments tool execution:`, error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          return {
            content: [{ type: "text", text: `Invalid input: ${JSON.stringify(error.errors)}` }],
            isError: true,
          };
        }

        // Handle generic errors
        let errorMessage = `Failed to extract key moments from the video.`;
        if (error.message) {
          errorMessage += ` Details: ${error.message}`;
        }
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});



// --- 4. Server Execution Logic ---
async function run() {
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.error("YouTube Vision MCP Server (using request handlers) running on stdio. Ready for requests.");
  } catch (error) {
    console.error("Failed to connect or start the server:", error);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("Fatal error during server execution:", error);
  process.exit(1);
});