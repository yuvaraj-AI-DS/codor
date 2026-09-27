# CODORuntime

**A Python editor that tests your code while you write it.**
Built by **thefours**.

## The problem

Testing is usually a separate step: save the file, switch to a terminal, run it, read the output, go back, fix, and repeat. All that switching wastes time, especially in multi-file projects.

## The solution

CODORuntime runs your Python code automatically as you type, right in the browser. No Run button, no terminal, no saving. You see instantly whether your code works, and if it doesn't, you see why.

## Features

- **Live execution:** code runs automatically a moment after you stop typing
- **Bob, the error assistant:** explains Python errors in plain English, with the line number and a suggested fix
- **Error highlighting:** the failing line is underlined in the editor
- **Multiple files:** open several tabs; files can import each other
- **Version history:** each file keeps its own versions, saved automatically whenever you fix an error
- **Execution stream:** a log of every run with time, result and duration
- **Efficiency score:** based on success rate, speed and how fast you recover from errors
- **File handling:** save as `.py`, import files (or drag and drop), export everything as a `.zip`
- **input() support:** programs that ask for input work without freezing the page

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS
- Monaco Editor (the editor behind VS Code)
- Pyodide (Python compiled to WebAssembly)
- IndexedDB (version history)
- File System Access API (saving files)

Everything runs in the browser. There is no backend server, and your code never leaves your machine.

## Getting started

Requirements: Node.js 18 or newer

```bash
git clone <your-repo-url>
cd CODOR
npm install
npm run dev
```

Open `http://localhost:5173`.

- Home page: `/`
- Editor: `/#/editor`

## Build for production

```bash
npm run build
npm run preview
```

The production files are in the `dist` folder and can be deployed to any static host, such as Netlify, Vercel or GitHub Pages.

## Project structure
