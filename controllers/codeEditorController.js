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
    // For Java, this will split multiple classes into separate files
    const files = getFilesForPiston(language, code);
    
    const pistonPayload = {
      language: pistonLanguage,
      version: languageVersions[pistonLanguage] || languageVersions[language.toLowerCase()] || version || '*',
      files: files,
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
 * Helper function to split Java code into multiple files (one class per file)
 * Returns array of {name, content} objects for Piston API
 */
function splitJavaIntoFiles(code) {
  // Get imports and package statements (to include in all files)
  const importPattern = /^(import\s+[\w.*]+\s*;|package\s+[\w.]+\s*;)/gm;
  const imports = [];
  let match;
  while ((match = importPattern.exec(code)) !== null) {
    imports.push(match[1]);
  }
  const importsBlock = imports.length > 0 ? imports.join('\n') + '\n\n' : '';

  // Find all class declarations with their full content
  // This regex captures: optional "public", "class", class name, and everything until the matching closing brace
  const classPattern = /((?:public\s+)?class\s+(\w+)\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w,\s]+\s*)?\{)/g;
  const classes = [];
  
  let lastIndex = 0;
  const codeWithoutImports = code.replace(/^(import\s+[\w.*]+\s*;|package\s+[\w.]+\s*;)\s*/gm, '');
  
  // Find all class start positions
  const classStarts = [];
  while ((match = classPattern.exec(codeWithoutImports)) !== null) {
    classStarts.push({
      fullMatch: match[1],
      className: match[2],
      startIndex: match.index
    });
  }

  // Extract each class with its content
  for (let i = 0; i < classStarts.length; i++) {
    const current = classStarts[i];
    const startIdx = current.startIndex;
    
    // Find the matching closing brace for this class
    let braceCount = 0;
    let endIdx = startIdx;
    let foundStart = false;
    
    for (let j = startIdx; j < codeWithoutImports.length; j++) {
      if (codeWithoutImports[j] === '{') {
        braceCount++;
        foundStart = true;
      } else if (codeWithoutImports[j] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endIdx = j + 1;
          break;
        }
      }
    }
    
    const classContent = codeWithoutImports.substring(startIdx, endIdx).trim();
    classes.push({
      name: current.className,
      content: importsBlock + classContent
    });
  }

  // If no classes found, return original code as Main.java
  if (classes.length === 0) {
    return [{ name: 'Main.java', content: code }];
  }

  // Detect which class has the main method
  let mainClassName = null;
  const mainMethodPattern = /public\s+static\s+void\s+main\s*\(\s*String/;
  
  for (const cls of classes) {
    if (mainMethodPattern.test(cls.content)) {
      mainClassName = cls.name;
      break;
    }
  }

  // Convert to file format
  const files = classes.map(cls => ({
    name: `${cls.name}.java`,
    content: cls.content
  }));

  // Move main class file to first position (Piston runs the first file)
  if (mainClassName) {
    const mainIndex = files.findIndex(f => f.name === `${mainClassName}.java`);
    if (mainIndex > 0) {
      const mainFile = files.splice(mainIndex, 1)[0];
      files.unshift(mainFile);
    }
    console.log(`Java main class detected: ${mainClassName}, split into ${files.length} files`);
  }

  return files;
}

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

/**
 * Helper function to get files array for Piston API
 * For Java, splits multiple classes into separate files
 */
function getFilesForPiston(language, code) {
  const lang = language.toLowerCase();
  
  // For Java, split classes into separate files
  if (lang === 'java') {
    return splitJavaIntoFiles(code);
  }

  // For other languages, return single file
  return [{
    name: getFileName(language),
    content: code
  }];
}

module.exports = {
  executeCode,
  getRuntimes
};

