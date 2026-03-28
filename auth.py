"""
auth.py — Google OAuth2 authentication for Google Classroom + Drive APIs.

First run: opens a browser window for the user to grant consent.
Subsequent runs: loads and auto-refreshes the saved token (headless).
"""

import os
import logging

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me",
    "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
    "https://www.googleapis.com/auth/drive",
]


def get_credentials(
    credentials_file: str = "credentials.json",
    token_file: str = "token.json",
    scopes: list = None,
) -> Credentials:
    """
    Load saved OAuth2 token if it exists and is valid.
    Refresh automatically if expired.
    Run browser consent flow on first run (no token.json yet).
    """
    if scopes is None:
        scopes = SCOPES

    if not os.path.exists(credentials_file):
        raise FileNotFoundError(
            f"'{credentials_file}' not found.\n"
            "Download it from Google Cloud Console:\n"
            "  1. Go to https://console.cloud.google.com\n"
            "  2. Enable the Classroom API and Drive API\n"
            "  3. Create OAuth 2.0 credentials (Desktop app)\n"
            "  4. Download and save as 'credentials.json' in this directory"
        )

    creds = None

    if os.path.exists(token_file):
        logger.debug("Loading saved token from %s", token_file)
        creds = Credentials.from_authorized_user_file(token_file, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired token...")
            creds.refresh(Request())
        else:
            logger.info("No valid token found — starting OAuth2 consent flow...")
            flow = InstalledAppFlow.from_client_secrets_file(credentials_file, scopes)
            print("\n" + "="*60)
            print("ACTION REQUIRED: Open the following URL in your browser")
            print("="*60)
            creds = flow.run_local_server(port=8080, open_browser=False)
            print("="*60 + "\n")

        with open(token_file, "w") as f:
            f.write(creds.to_json())
        logger.info("Token saved to %s", token_file)

    return creds


def build_classroom_service(creds: Credentials):
    """Return a Google Classroom API v1 service client."""
    return build("classroom", "v1", credentials=creds)


def build_drive_service(creds: Credentials):
    """Return a Google Drive API v3 service client."""
    return build("drive", "v3", credentials=creds)
