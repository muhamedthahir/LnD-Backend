// codeEditorController.js

/**
 * Execute code using Piston API
 * Piston is a code execution engine that supports multiple languages
 */
const executeCode = async (req, res) => {
  try {
    const { language, version, code, stdin = '' } = req.body;

    // Validate required fields
    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Get Piston API configuration from environment variables
    const pistonUrl = process.env.PISTON_URL || 'http://localhost';
    const pistonPort = process.env.PISTON_PORT || '2000';
    const pistonEndpoint = `${pistonUrl}:${pistonPort}/api/v2/execute`;

    // Language version mapping (default versions for common languages)
    const languageVersions = {
      'javascript': version || '18.15.0',
      'python': version || '3.10.0',
      'java': version || '15.0.2',
      'c': version || '10.2.0',
      'cpp': version || '10.2.0',
      'c++': version || '10.2.0',
      'typescript': version || '5.0.3',
      'go': version || '1.16.2',
      'rust': version || '1.68.2',
      'ruby': version || '3.0.1',
      'php': version || '8.2.3',
      'csharp': version || '6.12.0',
      'swift': version || '5.3.3',
      'kotlin': version || '1.8.20'
    };

    // Prepare the request payload for Piston API
    const pistonPayload = {
      language: language.toLowerCase(),
      version: languageVersions[language.toLowerCase()] || version || '*',
      files: [
        {
          name: getFileName(language),
          content: code
        }
      ],
      stdin: stdin,
      args: [],
      compile_timeout: 10000,
      run_timeout: 5000,
      compile_memory_limit: -1,
      run_memory_limit: -1
    };

    console.log(`Executing ${language} code via Piston API at ${pistonEndpoint}`);

    // Make request to Piston API
    const response = await fetch(pistonEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pistonPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Piston API error:', errorText);
      return res.status(response.status).json({ 
        error: 'Code execution failed',
        details: errorText
      });
    }

    const result = await response.json();

    // Format the response
    const formattedResult = {
      language: result.language,
      version: result.version,
      run: {
        stdout: result.run?.stdout || '',
        stderr: result.run?.stderr || '',
        code: result.run?.code,
        signal: result.run?.signal,
        output: result.run?.output || result.run?.stdout || ''
      },
      compile: result.compile ? {
        stdout: result.compile?.stdout || '',
        stderr: result.compile?.stderr || '',
        code: result.compile?.code,
        signal: result.compile?.signal
      } : null
    };

    res.json(formattedResult);

  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({ 
      error: 'Failed to execute code',
      details: error.message
    });
  }
};

/**
 * Get available runtimes from Piston API
 */
const getRuntimes = async (req, res) => {
  try {
    const pistonUrl = process.env.PISTON_URL || 'http://localhost';
    const pistonPort = process.env.PISTON_PORT || '2000';
    const runtimesEndpoint = `${pistonUrl}:${pistonPort}/api/v2/runtimes`;

    const response = await fetch(runtimesEndpoint);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Failed to fetch runtimes'
      });
    }

    const runtimes = await response.json();
    res.json(runtimes);

  } catch (error) {
    console.error('Get runtimes error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available runtimes',
      details: error.message
    });
  }
};

/**
 * Helper function to get appropriate file name based on language
 */
function getFileName(language) {
  const fileExtensions = {
    'javascript': 'solution.js',
    'python': 'solution.py',
    'java': 'Solution.java',
    'c': 'solution.c',
    'cpp': 'solution.cpp',
    'c++': 'solution.cpp',
    'typescript': 'solution.ts',
    'go': 'solution.go',
    'rust': 'solution.rs',
    'ruby': 'solution.rb',
    'php': 'solution.php',
    'csharp': 'Solution.cs',
    'swift': 'solution.swift',
    'kotlin': 'Solution.kt'
  };

  return fileExtensions[language.toLowerCase()] || 'solution.txt';
}

module.exports = {
  executeCode,
  getRuntimes
};

