#!/usr/bin/env python3
"""
Test script for OpenAI-compatible TTS API
"""

import os
import sys
import requests
import time
from pathlib import Path

# Configuration
API_URL = os.getenv("API_URL", "http://localhost:8000")
OUTPUT_DIR = Path(__file__).parent / "test_output"


def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{API_URL}/health")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}")
    return response.status_code == 200


def test_voices():
    """Test voices endpoint"""
    print("\nTesting voices endpoint...")
    response = requests.get(f"{API_URL}/v1/voices")
    print(f"  Status: {response.status_code}")
    data = response.json()
    print(f"  Available voices: {data.get('voices', [])}")
    print(f"  Supported languages: {len(data.get('supported_languages', []))} languages")
    return response.status_code == 200


def test_tts(text, voice="alloy", format="mp3", speed=1.0, language="en"):
    """Test TTS endpoint"""
    print(f"\nTesting TTS endpoint...")
    print(f"  Text: {text[:50]}...")
    print(f"  Voice: {voice}")
    print(f"  Format: {format}")
    print(f"  Speed: {speed}")
    print(f"  Language: {language}")

    # Create output directory
    OUTPUT_DIR.mkdir(exist_ok=True)

    # Make request
    start_time = time.time()
    response = requests.post(
        f"{API_URL}/v1/audio/speech",
        json={
            "model": "tts-1",
            "input": text,
            "voice": voice,
            "response_format": format,
            "speed": speed,
            "language": language
        }
    )
    elapsed = time.time() - start_time

    print(f"  Status: {response.status_code}")
    print(f"  Response time: {elapsed:.2f}s")

    if response.status_code == 200:
        # Save audio file
        output_file = OUTPUT_DIR / f"test_{voice}_{format}.{format}"
        with open(output_file, "wb") as f:
            f.write(response.content)

        audio_size = len(response.content) / 1024
        print(f"  Audio size: {audio_size:.1f} KB")
        print(f"  Saved to: {output_file}")
        return True
    else:
        print(f"  Error: {response.text}")
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("TTS API Test Suite")
    print("=" * 70)
    print(f"API URL: {API_URL}")
    print()

    # Test health
    if not test_health():
        print("\n❌ Health check failed. Is the server running?")
        print(f"   Start the server with: ./start_server.sh")
        sys.exit(1)

    # Test voices
    test_voices()

    # Test TTS with different configurations
    test_cases = [
        {
            "text": "Hello! This is a test of the OpenAI compatible text to speech API.",
            "voice": "alloy",
            "format": "mp3",
            "speed": 1.0,
            "language": "en"
        },
        {
            "text": "This is a test with a faster speed.",
            "voice": "alloy",
            "format": "wav",
            "speed": 1.5,
            "language": "en"
        },
        {
            "text": "Bonjour! Ceci est un test en français.",
            "voice": "echo",
            "format": "mp3",
            "speed": 1.0,
            "language": "fr"
        }
    ]

    success_count = 0
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'=' * 70}")
        print(f"Test Case {i}/{len(test_cases)}")
        print(f"{'=' * 70}")
        if test_tts(**test_case):
            success_count += 1

    # Summary
    print()
    print("=" * 70)
    print("Test Summary")
    print("=" * 70)
    print(f"  Total tests: {len(test_cases)}")
    print(f"  Passed: {success_count}")
    print(f"  Failed: {len(test_cases) - success_count}")
    print()

    if success_count == len(test_cases):
        print("✅ All tests passed!")
        print(f"\nTest audio files saved to: {OUTPUT_DIR}")
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
