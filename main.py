"""
main.py — Google Classroom Homework Agent

Runs once (triggered weekly by cron). For each active course:
  1. Finds assignments that are NOT yet turned in.
  2. Uses Claude to complete them in Hebrew.
  3. Submits them back to Google Classroom.
"""

import logging
import os
import sys

from dotenv import load_dotenv

import auth
import classroom_client
import homework_solver


# ── Logging setup ──────────────────────────────────────────────────────────

def setup_logging() -> logging.Logger:
    os.makedirs("logs", exist_ok=True)
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("logs/agent.log", encoding="utf-8"),
        ],
    )
    return logging.getLogger(__name__)


# ── Per-assignment pipeline ────────────────────────────────────────────────

def process_assignment(
    classroom_service,
    drive_service,
    course: dict,
    coursework: dict,
    logger: logging.Logger,
) -> None:
    course_name = course.get("name", course["id"])
    title = coursework.get("title", coursework["id"])

    logger.info("  Assignment: '%s'", title)

    # 1. Check current submission state
    submission = classroom_client.get_my_submission(
        classroom_service, course["id"], coursework["id"]
    )
    if submission is None:
        logger.warning("  Could not fetch submission for '%s'. Skipping.", title)
        return

    state = submission.get("state", "")
    if state in ("TURNED_IN", "RETURNED"):
        logger.info("  Already submitted (state=%s). Skipping.", state)
        return

    logger.info("  State: %s — will solve and submit.", state)

    # 2. Collect materials text from Drive attachments
    materials_text = ""
    for material in coursework.get("materials", []):
        drive_entry = material.get("driveFile", {})
        drive_file = drive_entry.get("driveFile", {})
        file_id = drive_file.get("id")
        if file_id:
            logger.debug("  Fetching material file %s...", file_id)
            content = classroom_client.get_drive_file_content(drive_service, file_id)
            if content:
                materials_text += f"\n---\n{content}"
        elif "youtubeVideo" in material:
            yt = material["youtubeVideo"]
            materials_text += f"\n[סרטון YouTube: {yt.get('title', '')}]"
        elif "link" in material:
            lnk = material["link"]
            materials_text += f"\n[קישור: {lnk.get('title', lnk.get('url', ''))}]"
        elif "form" in material:
            frm = material["form"]
            materials_text += f"\n[טופס: {frm.get('title', '')}]"

    # 3. Solve with Claude
    result = homework_solver.solve_assignment(coursework, materials_text.strip())

    # 4. Submit based on type
    submission_id = submission["id"]

    if result["type"] == "short_answer":
        classroom_client.patch_submission_with_text(
            classroom_service,
            course["id"],
            coursework["id"],
            submission_id,
            result["answer_text"],
        )
        classroom_client.turn_in_submission(
            classroom_service, course["id"], coursework["id"], submission_id
        )

    elif result["type"] == "multiple_choice":
        classroom_client.patch_submission_with_multiple_choice(
            classroom_service,
            course["id"],
            coursework["id"],
            submission_id,
            result["choice_answer"],
        )
        classroom_client.turn_in_submission(
            classroom_service, course["id"], coursework["id"], submission_id
        )

    elif result["type"] == "essay":
        # Upload .docx to Drive, attach it, then turn in
        docx_filename = f"{title[:60]}.docx"
        drive_file_id = classroom_client.upload_docx_to_drive(
            drive_service, result["docx_path"], docx_filename
        )
        classroom_client.attach_drive_file_to_submission(
            classroom_service,
            course["id"],
            coursework["id"],
            submission_id,
            drive_file_id,
        )
        classroom_client.turn_in_submission(
            classroom_service, course["id"], coursework["id"], submission_id
        )
        # Clean up temp file
        try:
            os.remove(result["docx_path"])
        except OSError:
            pass

    logger.info(
        "  DONE: '%s' in '%s' submitted as %s.",
        title,
        course_name,
        result["type"],
    )


# ── Entry point ────────────────────────────────────────────────────────────

def main() -> None:
    load_dotenv()
    logger = setup_logging()
    logger.info("=== Google Classroom Homework Agent starting ===")

    # Validate required env vars
    if not os.environ.get("ANTHROPIC_API_KEY"):
        logger.error(
            "ANTHROPIC_API_KEY is not set. "
            "Copy .env.example to .env and fill in your API key."
        )
        sys.exit(1)

    # Authenticate
    credentials_file = os.environ.get("GOOGLE_CREDENTIALS_FILE", "credentials.json")
    token_file = os.environ.get("GOOGLE_TOKEN_FILE", "token.json")

    try:
        creds = auth.get_credentials(credentials_file, token_file)
    except FileNotFoundError as e:
        logger.error("%s", e)
        sys.exit(1)

    classroom_service = auth.build_classroom_service(creds)
    drive_service = auth.build_drive_service(creds)

    # Process all active courses
    courses = classroom_client.list_active_courses(classroom_service)
    if not courses:
        logger.info("No active courses found. Nothing to do.")
        logger.info("=== Agent run complete ===")
        return

    total_done = 0
    total_skipped = 0
    total_errors = 0

    for course in courses:
        course_name = course.get("name", course["id"])
        logger.info("--- Course: '%s' ---", course_name)

        assignments = classroom_client.list_coursework(classroom_service, course["id"])
        if not assignments:
            logger.info("  No assignments found.")
            continue

        for cw in assignments:
            try:
                process_assignment(classroom_service, drive_service, course, cw, logger)
                total_done += 1
            except Exception:
                logger.exception(
                    "  ERROR processing '%s' in '%s'. Continuing...",
                    cw.get("title", cw["id"]),
                    course_name,
                )
                total_errors += 1

    logger.info(
        "=== Agent run complete. Processed: %d, Errors: %d ===",
        total_done,
        total_errors,
    )


if __name__ == "__main__":
    main()
