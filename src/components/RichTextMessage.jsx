import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;

function parseBold(text) {
  const result = [];
  let lastIndex = 0;
  let match;

  while ((match = BOLD_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    result.push(
      <strong key={`b-${match.index}-${match[1]}`} className="font-semibold text-white">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

function renderLine(line, lineIndex) {
  if (!line) return <span key={`line-${lineIndex}`}> </span>;

  const pieces = line.split(URL_REGEX);

  return pieces.map((piece, pieceIndex) => {
    if (!piece) return null;
    if (piece.startsWith("http://") || piece.startsWith("https://")) {
      return (
        <a
          key={`link-${lineIndex}-${pieceIndex}`}
          href={piece}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          onClick={(event) => event.stopPropagation()}
        >
          {piece}
        </a>
      );
    }

    return (
      <React.Fragment key={`txt-${lineIndex}-${pieceIndex}`}>
        {parseBold(piece)}
      </React.Fragment>
    );
  });
}

export default function RichTextMessage({ text, className = "", maxChars }) {
  const raw = String(text || "");
  const compact = typeof maxChars === "number" && raw.length > maxChars ? `${raw.slice(0, maxChars).trimEnd()}...` : raw;
  const lines = compact.split(/\r?\n/);

  return (
    <p className={className}>
      {lines.map((line, index) => (
        <React.Fragment key={`l-${index}`}>
          {renderLine(line, index)}
          {index < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </p>
  );
}
