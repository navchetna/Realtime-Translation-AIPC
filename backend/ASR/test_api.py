#!/usr/bin/env python3
"""
Test script for OpenAI-compatible Whisper ASR API
"""

import os
import sys
import requests
import time
from pathlib import Path

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8001")
DEMO_AUDIO = Path(__file__).parent / "demo_voice.wav"


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{API_URL}/health")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}")
    return response.status_code == 200


def test_transcription(audio_file, language="en", response_format="json"):
    """Test transcription endpoint"""
    print(f"\nTesting transcription...")
    print(f"  Audio: {audio_file}")
    print(f"  Language: {language}")
    print(f"  Format: {response_format}")

    if not audio_file.exists():
        print(f"  ❌ Audio file not found: {audio_file}")
        return False

    start_time = time.time()
    with open(audio_file, "rb") as f:
        response = requests.post(
            f"{API_URL}/v1/audio/transcriptions",
            files={"file": (audio_file.name, f, "audio/wav")},
            data={
                "model": "whisper-1",
                "language": language,
                "response_format": response_format
            }
        )
    elapsed = time.time() - start_time

    print(f"  Status: {response.status_code}")
    print(f"  Response time: {elapsed:.2f}s")

    if response.status_code == 200:
        if response_format == "json":
            data = response.json()
            print(f"  Text: {data.get('text', 'N/A')}")
        elif response_format == "verbose_json":
            data = response.json()
            print(f"  Task: {data.get('task', 'N/A')}")
            print(f"  Language: {data.get('language', 'N/A')}")
            print(f"  Duration: {data.get('duration', 0):.2f}s")
            print(f"  Text: {data.get('text', 'N/A')}")
        else:
            print(f"  Response: {response.text[:200]}...")
        return True
    else:
        print(f"  Error: {response.text}")
        return False


def test_translation(audio_file):
    """Test translation endpoint"""
    print(f"\nTesting translation...")
    print(f"  Audio: {audio_file}")

    if not audio_file.exists():
        print(f"  ❌ Audio file not found: {audio_file}")
        return False

    start_time = time.time()
    with open(audio_file, "rb") as f:
        response = requests.post(
            f"{API_URL}/v1/audio/translations",
            files={"file": (audio_file.name, f, "audio/wav")},
            data={"model": "whisper-1"}
        )
    elapsed = time.time() - start_time

    print(f"  Status: {response.status_code}")
    print(f"  Response time: {elapsed:.2f}s")

    if response.status_code == 200:
        data = response.json()
        print(f"  Text: {data.get('text', 'N/A')}")
        return True
    else:
        print(f"  Error: {response.text}")
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("Whisper ASR API Test Suite")
    print("=" * 70)
    print(f"API URL: {API_URL}")
    print(f"Demo audio: {DEMO_AUDIO}")
    print()

    # Test health
    if not test_health():
        print("\n❌ Health check failed. Is the server running?")
        print(f"   Start the server with: ./start_server.sh")
        sys.exit(1)

    # Check if demo audio exists
    if not DEMO_AUDIO.exists():
        print(f"\n⚠ Demo audio file not found: {DEMO_AUDIO}")
        print("  Skipping transcription tests")
        return

    # Test transcription with different configurations
    test_cases = [
        {"audio_file": DEMO_AUDIO, "language": "en", "response_format": "json"},
        {"audio_file": DEMO_AUDIO, "language": "en", "response_format": "verbose_json"},
        {"audio_file": DEMO_AUDIO, "language": "en", "response_format": "text"},
    ]

    success_count = 0
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'=' * 70}")
        print(f"Test Case {i}/{len(test_cases)}")
        print(f"{'=' * 70}")
        if test_transcription(**test_case):
            success_count += 1

    # Test translation
    print(f"\n{'=' * 70}")
    print(f"Translation Test")
    print(f"{'=' * 70}")
    if test_translation(DEMO_AUDIO):
        success_count += 1

    # Summary
    total_tests = len(test_cases) + 1  # +1 for translation
    print()
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)
    print(f"  Total tests: {total_tests}")
    print(f"  Passed: {success_count}")
    print(f"  Failed: {total_tests - success_count}")
    print()

    if success_count == total_tests:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Could not connect to API at {API_URL}")
        print("   Make sure the server is running with: ./start_server.sh")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
