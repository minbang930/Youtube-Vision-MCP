# YouTube Vision MCP Server (`youtube-vision`)

[![NPM version](https://img.shields.io/npm/v/youtube-vision)](https://www.npmjs.com/package/youtube-vision) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![smithery badge](https://smithery.ai/badge/@minbang930/youtube-vision-mcp)](https://smithery.ai/mcp/@minbang930/youtube-vision-mcp)

<a href="https://glama.ai/mcp/servers/@minbang930/Youtube-Vision-MCP">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@minbang930/Youtube-Vision-MCP/badge" alt="Youtube Vision MCP" />
</a>

MCP (Model Context Protocol) server that utilizes the Google Gemini Vision API to interact with YouTube videos. It allows users to get descriptions, summaries, answers to questions, and extract key moments from YouTube videos.

## Features

*   Analyzes YouTube videos using the Gemini Vision API.
*   Provides multiple tools for different interactions:
    *   General description or Q&A (`ask_about_youtube_video`)
    *   Summarization (`summarize_youtube_video`)
    *   Key moment extraction (`extract_key_moments`)
*   Lists available Gemini models supporting `generateContent`.
*   Configurable Gemini model via environment variable.
*   Communicates via stdio (standard input/output).
## Prerequisites

Before using this server, ensure you have the following:

*   **Node.js:** Version 18 or higher recommended. You can download it from [nodejs.org](https://nodejs.org/).
*   **Google Gemini API Key:** Obtain your API key from [Google AI Studio](https://aistudio.google.com/app/apikey) or Google Cloud Console.


## Installation & Usage

There are two main ways to use this server:

### Installing via Smithery

To install youtube-vision-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/mcp/@minbang930/youtube-vision-mcp):

```bash
npx -y @smithery/cli install @minbang930/youtube-vision-mcp --client claude
```

### Option 1: Using npx (Recommended for quick use)

The easiest way to run this server is using `npx`, which downloads and runs the package without needing a permanent installation.

You can configure it within your MCP client's settings file (Claude, VSCode .. ):

```json
{
  "mcpServers": {
    "youtube-vision": {
      "command": "npx",
      "args": [
        "-y",
        "youtube-vision"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY",
        "GEMINI_MODEL_NAME": "gemini-2.0-flash"
      }
    }
  }
}
```

Replace `"YOUR_GEMINI_API_KEY"` with your actual Google Gemini API key.

### Option 2: Manual Installation (from Source)

If you want to modify the code or run it directly from the source:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/minbang930/Youtube-Vision-MCP.git
    cd youtube-vision
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the project:**
    ```bash
    npm run build
    ```

4.  **Configure and run:**
    You can then run the compiled code using `node dist/index.js` directly (ensure `GEMINI_API_KEY` is set as an environment variable) or configure your MCP client to run it using the `node` command and the absolute path to `dist/index.js`, passing the API key via the `env` setting as shown in the npx example.

## Configuration

The server uses the following environment variables:

*   `GEMINI_API_KEY` (Required): Your Google Gemini API key.
*   `GEMINI_MODEL_NAME` (Optional): The specific Gemini model to use (e.g., `gemini-1.5-flash`). Defaults to `gemini-2.0-flash`. **Important:** For production or commercial use, ensure you select a model version that is not marked as "Experimental" or "Preview".

Environment variables should be set in the `env` section of your MCP client's settings file (e.g., `mcp_settings.json`).

## Available Tools

### 1. `ask_about_youtube_video`

Answers a question about the video or provides a general description if no question is asked.

*   **Input:**
    *   `youtube_url` (string, required): The URL of the YouTube video.
    *   `question` (string, optional): The specific question to ask about the video. If omitted, a general description is generated.
*   **Output:** Text containing the answer or description.
*   **Example Usage (MCP Client):**
    ```xml
    <use_mcp_tool>
      <server_name>youtube-vision</server_name>
      <tool_name>ask_about_youtube_video</tool_name>
      <arguments>
      {
        "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "question": "What is the main topic discussed around 1:30?" 
      }
      </arguments>
    </use_mcp_tool>
    ```
    ```xml
    <use_mcp_tool>
      <server_name>youtube-vision</server_name>
      <tool_name>ask_about_youtube_video</tool_name>
      <arguments>
      {
        "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID"
      }
      </arguments>
    </use_mcp_tool>
    ```

### 2. `summarize_youtube_video`

Generates a summary of a given YouTube video.

*   **Input:**
    *   `youtube_url` (string, required): The URL of the YouTube video.
    *   `summary_length` (string, optional): Desired summary length ('short', 'medium', 'long'). Defaults to 'medium'.
*   **Output:** Text containing the video summary.
*   **Example Usage (MCP Client):**
    ```xml
    <use_mcp_tool>
      <server_name>youtube-vision</server_name>
      <tool_name>summarize_youtube_video</tool_name>
      <arguments>
      {
        "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "summary_length": "short"
      }
      </arguments>
    </use_mcp_tool>
    ```

### 3. `extract_key_moments`

Extracts key moments (timestamps and descriptions) from a given YouTube video.

*   **Input:**
    *   `youtube_url` (string, required): The URL of the YouTube video.
    *   `number_of_moments` (integer, optional): Number of key moments to extract. Defaults to 3.
*   **Output:** Text describing the key moments with timestamps.
*   **Example Usage (MCP Client):**
    ```xml
    <use_mcp_tool>
      <server_name>youtube-vision</server_name>
      <tool_name>extract_key_moments</tool_name>
      <arguments>
      {
        "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
        "number_of_moments": 5 
      }
      </arguments>
    </use_mcp_tool>
    ```

### 4. `list_supported_models`

Lists available Gemini models that support the `generateContent` method (fetched via REST API).

*   **Input:** None
*   **Output:** Text listing the supported model names.
*   **Example Usage (MCP Client):**
    ```xml
    <use_mcp_tool>
      <server_name>youtube-vision</server_name>
      <tool_name>list_supported_models</tool_name>
      <arguments>{}</arguments>
    </use_mcp_tool>
    ```


## Important Notes

*   **Model Selection for Production:** When using this server for production or commercial purposes, please ensure the selected `GEMINI_MODEL_NAME` is a stable version suitable for production use. According to the [Gemini API Terms of Service](https://ai.google.dev/gemini-api/terms), models marked as "Experimental" or "Preview" are not permitted for production deployment.
*   **API Terms of Service:** Usage of this server relies on the Google Gemini API. Users are responsible for reviewing and complying with the [Google APIs Terms of Service](https://developers.google.com/terms/) and the [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms). Note that data usage policies may differ between free and paid tiers of the Gemini API. Do not submit sensitive or confidential information when using free tiers.
*   **Content Responsibility:** The accuracy and appropriateness of content generated via the Gemini API are not guaranteed. Use discretion before relying on or publishing generated content.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
