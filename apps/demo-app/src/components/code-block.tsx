import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeBlockProps {
  code: string
  title?: string
  className?: string
}

export function CodeBlock({ code, title = "Code", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const highlightSyntax = (code: string) => {
    const lines = code.split("\n")

    return lines.map((line, lineIndex) => {
      const tokens = []
      let currentIndex = 0

      // Keywords to highlight
      const keywords = [
        "const",
        "let",
        "var",
        "if",
        "else",
        "for",
        "while",
        "function",
        "return",
        "await",
        "async",
        "new",
        "throw",
        "try",
        "catch",
        "import",
        "export",
        "default",
        "class",
        "extends",
        "interface",
        "type",
      ]

      while (currentIndex < line.length) {
        let matched = false

        // Check for comments
        if (line.slice(currentIndex, currentIndex + 2) === "//") {
          tokens.push(
            <span
              key={`${lineIndex}-${currentIndex}`}
              className="text-gray-500"
            >
              {line.slice(currentIndex)}
            </span>
          )
          break
        }

        // Check for strings
        if (
          line[currentIndex] === '"' ||
          line[currentIndex] === "'" ||
          line[currentIndex] === "`"
        ) {
          const quote = line[currentIndex]
          let endIndex = currentIndex + 1
          while (endIndex < line.length && line[endIndex] !== quote) {
            if (line[endIndex] === "\\") endIndex++ // Skip escaped characters
            endIndex++
          }
          if (endIndex < line.length) endIndex++ // Include closing quote

          tokens.push(
            <span
              key={`${lineIndex}-${currentIndex}`}
              className="text-emerald-600"
            >
              {line.slice(currentIndex, endIndex)}
            </span>
          )
          currentIndex = endIndex
          matched = true
        }

        // Check for numbers
        else if (/\d/.test(line[currentIndex])) {
          let endIndex = currentIndex
          while (endIndex < line.length && /[\d.n]/.test(line[endIndex])) {
            endIndex++
          }

          tokens.push(
            <span
              key={`${lineIndex}-${currentIndex}`}
              className="text-slate-600"
            >
              {line.slice(currentIndex, endIndex)}
            </span>
          )
          currentIndex = endIndex
          matched = true
        }

        // Check for keywords
        else if (/[a-zA-Z_$]/.test(line[currentIndex])) {
          let endIndex = currentIndex
          while (
            endIndex < line.length &&
            /[a-zA-Z0-9_$]/.test(line[endIndex])
          ) {
            endIndex++
          }

          const word = line.slice(currentIndex, endIndex)

          if (keywords.includes(word)) {
            tokens.push(
              <span
                key={`${lineIndex}-${currentIndex}`}
                className="text-cyan-600"
              >
                {word}
              </span>
            )
          } else {
            // Check if it's a property access (preceded by a dot)
            const prevChar = currentIndex > 0 ? line[currentIndex - 1] : ""
            if (prevChar === ".") {
              tokens.push(
                <span
                  key={`${lineIndex}-${currentIndex}`}
                  className="text-cyan-600"
                >
                  {word}
                </span>
              )
            } else {
              tokens.push(
                <span
                  key={`${lineIndex}-${currentIndex}`}
                  className="text-gray-800"
                >
                  {word}
                </span>
              )
            }
          }
          currentIndex = endIndex
          matched = true
        }

        if (!matched) {
          // Handle single characters (operators, punctuation, etc.)
          tokens.push(
            <span
              key={`${lineIndex}-${currentIndex}`}
              className="text-gray-800"
            >
              {line[currentIndex]}
            </span>
          )
          currentIndex++
        }
      }

      return (
        <div key={lineIndex}>
          {tokens}
          {lineIndex < lines.length - 1 && "\n"}
        </div>
      )
    })
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-gray-50/50 mt-4",
        className
      )}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 w-8 p-0 hover:bg-gray-200/50"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-gray-600" />
          )}
        </Button>
      </div>

      <div className="px-6 pb-6">
        <pre className="text-xs overflow-x-auto">
          <code className="block whitespace-pre font-mono leading-6">
            {highlightSyntax(code)}
          </code>
        </pre>
      </div>
    </div>
  )
}
