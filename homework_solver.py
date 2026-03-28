"""
homework_solver.py — Uses Google Gemini AI (free tier) to complete homework in Hebrew.

Handles three assignment types:
  - essay        (ASSIGNMENT workType)         → generates .docx
  - short_answer (SHORT_ANSWER_QUESTION)       → generates text
  - multiple_choice (MULTIPLE_CHOICE_QUESTION) → picks one option
"""

import logging
import os
import tempfile
import time
from typing import Optional

import google.generativeai as genai
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

logger = logging.getLogger(__name__)

# ── System prompt ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """אתה תלמיד חריף הכותב שיעורי בית בעברית טבעית ושוטפת.
עליך לכתוב את התשובות בעברית בלבד, בסגנון של תלמיד תיכון אינטליגנטי.
השתמש בשפה פשוטה וברורה, אך תוכן מדויק ומקצועי.
אל תוסיף הסברים מחוץ לתשובה עצמה — כתוב רק את התשובה הנדרשת."""

# ── Type detection ─────────────────────────────────────────────────────────

WORK_TYPE_MAP = {
    "ASSIGNMENT": "essay",
    "SHORT_ANSWER_QUESTION": "short_answer",
    "MULTIPLE_CHOICE_QUESTION": "multiple_choice",
}


def detect_assignment_type(coursework: dict) -> str:
    """Return 'essay', 'short_answer', or 'multiple_choice'."""
    work_type = coursework.get("workType", "ASSIGNMENT")
    assignment_type = WORK_TYPE_MAP.get(work_type)
    if assignment_type is None:
        logger.warning("Unknown workType '%s', treating as essay.", work_type)
        return "essay"
    return assignment_type


def extract_multiple_choice_options(coursework: dict) -> list:
    """Extract answer choices from a MULTIPLE_CHOICE_QUESTION."""
    mc = coursework.get("multipleChoiceQuestion", {})
    return mc.get("choices", [])


# ── Prompt builders ────────────────────────────────────────────────────────

def build_essay_prompt(title: str, description: str, materials_text: str) -> str:
    parts = [f"כתוב מטלה/חיבור בנושא: {title}"]
    if description:
        parts.append(f"הוראות המורה:\n{description}")
    if materials_text:
        parts.append(f"חומרי עזר שצורפו למטלה:\n{materials_text}")
    parts.append("כתוב תשובה מלאה ומפורטת בעברית.")
    return "\n\n".join(parts)


def build_short_answer_prompt(title: str, description: str) -> str:
    parts = [f"ענה על השאלה הבאה בעברית:\nשאלה: {title}"]
    if description:
        parts.append(description)
    parts.append("כתוב תשובה קצרה וממוקדת.")
    return "\n\n".join(parts)


def build_multiple_choice_prompt(title: str, description: str, choices: list) -> str:
    numbered = "\n".join(f"{i+1}. {c}" for i, c in enumerate(choices))
    parts = [f"בחר את התשובה הנכונה לשאלה הבאה:\nשאלה: {title}"]
    if description:
        parts.append(description)
    parts.append(f"אפשרויות:\n{numbered}")
    parts.append(
        "החזר רק את הטקסט המדויק של האפשרות הנכונה, ללא שום הסבר נוסף."
    )
    return "\n\n".join(parts)


# ── Gemini API call ────────────────────────────────────────────────────────

def call_gemini(
    user_prompt: str,
    system_prompt: str = SYSTEM_PROMPT,
    model: str = None,
    max_tokens: int = None,
) -> str:
    """Call Google Gemini (free tier) and return the response text."""
    if model is None:
        model = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
    if max_tokens is None:
        max_tokens = int(os.environ.get("GEMINI_MAX_TOKENS", "2048"))

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    gemini_model = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_prompt,
    )
    generation_config = genai.types.GenerationConfig(max_output_tokens=max_tokens)

    for attempt in range(2):
        try:
            response = gemini_model.generate_content(
                user_prompt,
                generation_config=generation_config,
            )
            text = response.text.strip()
            logger.debug("Gemini response received (%d chars).", len(text))
            return text
        except Exception as e:
            if "429" in str(e) and attempt == 0:
                logger.warning("Gemini rate limit hit. Waiting 60s before retry...")
                time.sleep(60)
            else:
                logger.error("Gemini API error: %s", e)
                raise

    return ""


# ── Multiple choice answer matching ───────────────────────────────────────

def match_choice_to_answer(raw_answer: str, choices: list) -> str:
    """
    Match Claude's raw response to one of the valid choices.
    1. Exact match (case-insensitive, stripped)
    2. Substring match (choice text found within raw_answer)
    3. Fallback: return raw_answer as-is
    """
    raw_stripped = raw_answer.strip()

    # Exact match
    for choice in choices:
        if choice.strip().lower() == raw_stripped.lower():
            return choice

    # Substring match
    for choice in choices:
        if choice.strip().lower() in raw_stripped.lower():
            return choice

    logger.warning(
        "Could not match Claude answer '%s' to choices %s. Using raw answer.",
        raw_stripped,
        choices,
    )
    return raw_stripped


# ── RTL .docx generation ───────────────────────────────────────────────────

def _set_paragraph_rtl(paragraph) -> None:
    """Set a paragraph's direction to RTL for Hebrew text."""
    pPr = paragraph._p.get_or_add_pPr()
    bidi = OxmlElement("w:bidi")
    bidi.set(qn("w:val"), "1")
    pPr.append(bidi)


def generate_docx(title: str, content: str, output_path: Optional[str] = None) -> str:
    """
    Create a .docx with RTL Hebrew text.
    Returns the path to the saved file.
    """
    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=".docx", prefix="hw_")
        os.close(fd)

    doc = Document()

    # Title
    heading = doc.add_heading(title, level=0)
    _set_paragraph_rtl(heading)

    # Body — split on double newlines to preserve paragraph structure
    paragraphs = content.strip().split("\n\n")
    for para_text in paragraphs:
        para_text = para_text.strip()
        if not para_text:
            continue
        p = doc.add_paragraph(para_text)
        _set_paragraph_rtl(p)

    doc.save(output_path)
    logger.debug("Generated .docx at %s", output_path)
    return output_path


# ── High-level solver ──────────────────────────────────────────────────────

def solve_assignment(coursework: dict, materials_text: str = "") -> dict:
    """
    Determine the assignment type, build a Hebrew prompt,
    call Claude, and return a result dict:

    {
        "type":          "essay" | "short_answer" | "multiple_choice",
        "answer_text":   str,          # Claude's raw output
        "docx_path":     str | None,   # path to generated .docx (essays only)
        "choice_answer": str | None,   # matched choice (MC only)
    }
    """
    title = coursework.get("title", "מטלה ללא כותרת")
    description = coursework.get("description", "")
    assignment_type = detect_assignment_type(coursework)

    result = {
        "type": assignment_type,
        "answer_text": "",
        "docx_path": None,
        "choice_answer": None,
    }

    if assignment_type == "essay":
        prompt = build_essay_prompt(title, description, materials_text)
        answer = call_gemini(prompt, max_tokens=int(os.environ.get("GEMINI_MAX_TOKENS", "2048")))
        result["answer_text"] = answer
        result["docx_path"] = generate_docx(title, answer)

    elif assignment_type == "short_answer":
        prompt = build_short_answer_prompt(title, description)
        answer = call_gemini(prompt, max_tokens=512)
        result["answer_text"] = answer

    elif assignment_type == "multiple_choice":
        choices = extract_multiple_choice_options(coursework)
        prompt = build_multiple_choice_prompt(title, description, choices)
        raw_answer = call_gemini(prompt, max_tokens=64)
        matched = match_choice_to_answer(raw_answer, choices) if choices else raw_answer
        result["answer_text"] = raw_answer
        result["choice_answer"] = matched

    logger.info(
        "Solved '%s' (%s): %d chars.",
        title,
        assignment_type,
        len(result["answer_text"]),
    )
    return result
