"""
classroom_client.py — All Google Classroom and Drive API calls.

Isolated from business logic so main.py and homework_solver.py stay clean.
"""

import io
import logging
from typing import Optional

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)


# ── Helper ─────────────────────────────────────────────────────────────────

def _paginate(request_fn, key: str) -> list:
    """Generic paginator. request_fn() is called with pageToken each iteration."""
    results = []
    page_token = None
    while True:
        resp = request_fn(page_token).execute()
        results.extend(resp.get(key, []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return results


# ── Courses ────────────────────────────────────────────────────────────────

def list_active_courses(service) -> list:
    """
    Return all courses where the authenticated user is a STUDENT
    and courseState == 'ACTIVE'.
    """
    try:
        def req(page_token):
            return service.courses().list(
                studentId="me",
                courseStates=["ACTIVE"],
                pageToken=page_token,
            )
        courses = _paginate(req, "courses")
        logger.info("Found %d active course(s).", len(courses))
        return courses
    except HttpError as e:
        logger.error("Failed to list courses: %s %s", e.status_code, e.reason)
        return []


# ── Coursework ─────────────────────────────────────────────────────────────

def list_coursework(service, course_id: str) -> list:
    """Return all coursework items for a given course."""
    try:
        def req(page_token):
            return service.courses().courseWork().list(
                courseId=course_id,
                pageToken=page_token,
            )
        items = _paginate(req, "courseWork")
        logger.debug("Course %s: found %d assignment(s).", course_id, len(items))
        return items
    except HttpError as e:
        if e.status_code == 404:
            logger.warning("Course %s not found (404). Skipping.", course_id)
            return []
        logger.error("Failed to list coursework for %s: %s %s", course_id, e.status_code, e.reason)
        return []


# ── Submissions ────────────────────────────────────────────────────────────

def get_my_submission(service, course_id: str, coursework_id: str) -> Optional[dict]:
    """
    Fetch the student's own submission for a specific coursework item.
    Returns the submission dict or None.

    Possible states: NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT
    """
    try:
        resp = service.courses().courseWork().studentSubmissions().list(
            courseId=course_id,
            courseWorkId=coursework_id,
            userId="me",
        ).execute()
        submissions = resp.get("studentSubmissions", [])
        if not submissions:
            logger.warning("No submission found for coursework %s.", coursework_id)
            return None
        return submissions[0]
    except HttpError as e:
        if e.status_code == 404:
            logger.warning("Submission not found for coursework %s (404).", coursework_id)
            return None
        logger.error("Failed to get submission for %s: %s %s", coursework_id, e.status_code, e.reason)
        return None


def patch_submission_with_text(
    service,
    course_id: str,
    coursework_id: str,
    submission_id: str,
    answer_text: str,
) -> Optional[dict]:
    """Set shortAnswerSubmission.answer on a SHORT_ANSWER_QUESTION submission."""
    try:
        result = service.courses().courseWork().studentSubmissions().patch(
            courseId=course_id,
            courseWorkId=coursework_id,
            id=submission_id,
            updateMask="shortAnswerSubmission",
            body={"shortAnswerSubmission": {"answer": answer_text}},
        ).execute()
        logger.debug("Patched shortAnswerSubmission for %s.", submission_id)
        return result
    except HttpError as e:
        logger.error("Failed to patch text submission %s: %s %s", submission_id, e.status_code, e.reason)
        raise


def patch_submission_with_multiple_choice(
    service,
    course_id: str,
    coursework_id: str,
    submission_id: str,
    answer: str,
) -> Optional[dict]:
    """Set multipleChoiceSubmission.answer on a MULTIPLE_CHOICE_QUESTION submission."""
    try:
        result = service.courses().courseWork().studentSubmissions().patch(
            courseId=course_id,
            courseWorkId=coursework_id,
            id=submission_id,
            updateMask="multipleChoiceSubmission",
            body={"multipleChoiceSubmission": {"answer": answer}},
        ).execute()
        logger.debug("Patched multipleChoiceSubmission for %s.", submission_id)
        return result
    except HttpError as e:
        logger.error("Failed to patch MC submission %s: %s %s", submission_id, e.status_code, e.reason)
        raise


def attach_drive_file_to_submission(
    service,
    course_id: str,
    coursework_id: str,
    submission_id: str,
    drive_file_id: str,
) -> Optional[dict]:
    """Attach an already-uploaded Drive file to the submission."""
    try:
        result = service.courses().courseWork().studentSubmissions().modifyAttachments(
            courseId=course_id,
            courseWorkId=coursework_id,
            id=submission_id,
            body={"addAttachments": [{"driveFile": {"id": drive_file_id}}]},
        ).execute()
        logger.debug("Attached Drive file %s to submission %s.", drive_file_id, submission_id)
        return result
    except HttpError as e:
        logger.error("Failed to attach Drive file to %s: %s %s", submission_id, e.status_code, e.reason)
        raise


def turn_in_submission(
    service,
    course_id: str,
    coursework_id: str,
    submission_id: str,
) -> None:
    """Mark the submission as TURNED_IN."""
    try:
        service.courses().courseWork().studentSubmissions().turnIn(
            courseId=course_id,
            courseWorkId=coursework_id,
            id=submission_id,
            body={},
        ).execute()
        logger.info("Submission %s turned in successfully.", submission_id)
    except HttpError as e:
        logger.error("Failed to turn in submission %s: %s %s", submission_id, e.status_code, e.reason)
        raise


# ── Drive ──────────────────────────────────────────────────────────────────

def upload_docx_to_drive(drive_service, file_path: str, filename: str) -> str:
    """
    Upload a local .docx file to Google Drive.
    Returns the Drive file ID.
    """
    try:
        media = MediaFileUpload(
            file_path,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            resumable=True,
        )
        file_metadata = {"name": filename}
        uploaded = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id",
        ).execute()
        file_id = uploaded.get("id")
        logger.info("Uploaded '%s' to Drive as file ID %s.", filename, file_id)
        return file_id
    except HttpError as e:
        logger.error("Failed to upload file to Drive: %s %s", e.status_code, e.reason)
        raise


def get_drive_file_content(drive_service, file_id: str, max_chars: int = 4000) -> str:
    """
    Download a Drive file's text content.
    Tries to export Google Docs as plain text first;
    falls back to binary download for other file types.
    Returns up to max_chars characters.
    """
    try:
        # Try exporting as plain text (works for Google Docs)
        try:
            request = drive_service.files().export(
                fileId=file_id, mimeType="text/plain"
            )
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            content = fh.getvalue().decode("utf-8", errors="replace")
        except HttpError:
            # Fall back to raw download for non-Google-Docs files
            request = drive_service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            content = fh.getvalue().decode("utf-8", errors="replace")

        if len(content) > max_chars:
            content = content[:max_chars] + "\n...[קוצר]"
        return content

    except HttpError as e:
        logger.warning(
            "Could not read Drive file %s: %s %s. Skipping its content.",
            file_id, e.status_code, e.reason,
        )
        return ""
