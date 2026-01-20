import React from "react";

/**
 * Text formatting utilities for chat messages
 * Handles URL conversion, card number formatting, and date formatting
 */

/**
 * Converts URLs to clickable links and formats card numbers and dates as inline code
 * @param text - The text to format
 * @returns Array of React elements for rendering
 */
export function formatChatText(text: string): (string | React.ReactElement)[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const cardNumberRegex = /`(\d{4}\s\d{4}\s\d{4}\s\d{4})`/g;
  const dateRegex = /`(\d{2}\/\d{4})`/g;

  // Clean up any asterisks around dates and convert to backticks
  let processedText = text.replace(/\*\*(\d{2}\/\d{4})\*\*/g, "`$1`");

  // First, handle card numbers and dates in backticks
  processedText = processedText.replace(
    cardNumberRegex,
    (match, cardNumber) => {
      return `<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">${cardNumber}</code>`;
    }
  );

  processedText = processedText.replace(dateRegex, (match, date) => {
    return `<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">${date}</code>`;
  });

  // Then handle URLs
  return processedText.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      const urlObj = new URL(part);
      let friendlyName = part;
      // Match hexadecimal agent ID (64 characters)
      const hexMatch = part.match(/[a-f0-9]{64}/i);
      if (hexMatch) {
        friendlyName = hexMatch[0];
      } else if (part.match(/\.(jpg|jpeg|png|gif|webp|mp3|mp4)$/i)) {
        friendlyName = urlObj.pathname.split("/").pop() || part;
      } else {
        const domain = urlObj.hostname.replace("www.", "");
        const firstPath = urlObj.pathname.split("/")[1] || "";
        friendlyName = `${domain}${firstPath ? `/${firstPath}` : ""}`;
      }
      return (
        <a
          key={index}
          href={part}
          target={
            urlObj.hostname.endsWith("nevermined.dev") ||
            urlObj.hostname.endsWith("nevermined.app")
              ? undefined
              : "_blank"
          }
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {friendlyName}
        </a>
      );
    }
    // Handle HTML content (card numbers and dates)
    if (part.includes("<code")) {
      return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
    }
    return part;
  });
}
