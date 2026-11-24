import { useState } from "react";

export default function ReviewText({ comment = "" }) {
  const [expanded, setExpanded] = useState(false);
  const fullText = String(comment ?? "");
  const longText = fullText.length > 240;

  return (
    <>
      <p
        className={
          "review-comment" + (longText && !expanded ? " collapsed" : "")
        }
      >
        {fullText}
      </p>
      {longText && (
        <button
          type="button"
          className="review-expand"
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? "Свернуть отзыв" : "Показать полностью"}
        </button>
      )}
    </>
  );
}
