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

    // Use language as-is (no conversion)
    const pistonLanguage = language.toLowerCase();

    // Language version mapping (default versions for common languages)
    const languageVersions = {
      'node': version || '18.15.0',
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
      language: pistonLanguage,
      version: languageVersions[pistonLanguage] || languageVersions[language.toLowerCase()] || version || '*',
      files: [
        {
          name: getFileName(language, code),
          content: code
        }
      ],
      stdin: stdin,
      args: [],
      compile_timeout: 10000,
      run_timeout: 10000,
      compile_memory_limit: -1,
      run_memory_limit: -1
    };

    console.log(`Executing ${language} code via Piston API at ${pistonEndpoint} with payload: ${JSON.stringify(pistonPayload)}`);

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
 * Helper function to detect the main class in Java code
 * Finds the class that contains "public static void main(String" method
 */
function detectJavaMainClass(code) {
  // Remove comments to avoid false matches
  const codeWithoutComments = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\/\/.*$/gm, '');         // Remove single-line comments

  // Find the position of the main method
  // Matches: public static void main(String[] args) / (String args[]) / (String... args)
  const mainMethodMatch = codeWithoutComments.match(/public\s+static\s+void\s+main\s*\(\s*String/);
  
  if (mainMethodMatch) {
    // Get everything before the main method
    const beforeMain = codeWithoutComments.substring(0, mainMethodMatch.index);
    
    // Find all class declarations before the main method
    // The last one will be the class containing the main method
    const classMatches = [...beforeMain.matchAll(/(?:public\s+)?class\s+(\w+)/g)];
    
    if (classMatches.length > 0) {
      // Return the last class declared before main (the class containing main)
      const mainClassName = classMatches[classMatches.length - 1][1];
      console.log(`Detected Java main class: ${mainClassName}`);
      return mainClassName;
    }
  }

  // Fallback: find any public class
  const publicClassMatch = codeWithoutComments.match(/public\s+class\s+(\w+)/);
  if (publicClassMatch) {
    console.log(`No main method found, using public class: ${publicClassMatch[1]}`);
    return publicClassMatch[1];
  }

  // Fallback: find any class
  const anyClassMatch = codeWithoutComments.match(/class\s+(\w+)/);
  if (anyClassMatch) {
    console.log(`No main method found, using first class: ${anyClassMatch[1]}`);
    return anyClassMatch[1];
  }

  console.log('No class found, using default: Main');
  return 'Main';
}

/**
 * Helper function to get appropriate file name based on language
 */
function getFileName(language, code = '') {
  const lang = language.toLowerCase();
  
  // For Java, detect the main class dynamically
  if (lang === 'java') {
    const mainClassName = detectJavaMainClass(code);
    return `${mainClassName}.java`;
  }

  const fileExtensions = {
    'javascript': 'solution.js',
    'python': 'solution.py',
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

  return fileExtensions[lang] || 'solution.txt';
}

module.exports = {
  executeCode,
  getRuntimes
};

