#!/usr/bin/env python3
"""
Test client for LLM serving engine with OpenAI-compatible API
Demonstrates chat completions, streaming, and error handling
"""

import argparse
import sys
import time
from openai import OpenAI, OpenAIError


def test_chat_completion(client: OpenAI, model: str, message: str):
    """Test basic chat completion"""
    print("\n" + "=" * 70)
    print("Testing Chat Completion (Non-Streaming)")
    print("=" * 70)
    print(f"Message: {message}")
    print("-" * 70)

    try:
        start_time = time.time()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful AI assistant."},
                {"role": "user", "content": message}
            ],
            temperature=0.7,
            max_tokens=500
        )

        elapsed = time.time() - start_time

        print(f"Response: {response.choices[0].message.content}")
        print("-" * 70)
        print(f"Model: {response.model}")
        print(f"Tokens - Prompt: {response.usage.prompt_tokens}, "
              f"Completion: {response.usage.completion_tokens}, "
              f"Total: {response.usage.total_tokens}")
        print(f"Time: {elapsed:.2f}s")
        print(f"Tokens/sec: {response.usage.completion_tokens / elapsed:.1f}")
        print("=" * 70)
        return True

    except OpenAIError as e:
        print(f"ERROR: {e}")
        return False


def test_streaming(client: OpenAI, model: str, message: str):
    """Test streaming chat completion"""
    print("\n" + "=" * 70)
    print("Testing Streaming Chat Completion")
    print("=" * 70)
    print(f"Message: {message}")
    print("-" * 70)
    print("Response: ", end="", flush=True)

    try:
        start_time = time.time()
        total_tokens = 0

        stream = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": message}
            ],
            stream=True,
            max_tokens=200
        )

        for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                print(content, end="", flush=True)
                total_tokens += 1

        elapsed = time.time() - start_time

        print()
        print("-" * 70)
        print(f"Time: {elapsed:.2f}s")
        print(f"Approx tokens/sec: {total_tokens / elapsed:.1f}")
        print("=" * 70)
        return True

    except OpenAIError as e:
        print(f"\nERROR: {e}")
        return False


def test_completion(client: OpenAI, model: str, prompt: str):
    """Test legacy text completion"""
    print("\n" + "=" * 70)
    print("Testing Text Completion (Legacy)")
    print("=" * 70)
    print(f"Prompt: {prompt}")
    print("-" * 70)

    try:
        response = client.completions.create(
            model=model,
            prompt=prompt,
            max_tokens=100,
            temperature=0.7
        )

        print(f"Completion: {response.choices[0].text}")
        print("-" * 70)
        print(f"Model: {response.model}")
        print(f"Tokens - Prompt: {response.usage.prompt_tokens}, "
              f"Completion: {response.usage.completion_tokens}")
        print("=" * 70)
        return True

    except OpenAIError as e:
        print(f"ERROR: {e}")
        return False


def test_models_list(client: OpenAI):
    """Test listing available models"""
    print("\n" + "=" * 70)
    print("Testing Models List Endpoint")
    print("=" * 70)

    try:
        models = client.models.list()
        print("Available models:")
        for model in models.data:
            print(f"  - {model.id}")
        print("=" * 70)
        return True

    except OpenAIError as e:
        print(f"ERROR: {e}")
        return False


def check_server_health(base_url: str):
    """Check if server is healthy"""
    import requests

    health_url = base_url.replace("/v1", "") + "/health"

    print("\n" + "=" * 70)
    print("Checking Server Health")
    print("=" * 70)
    print(f"Health endpoint: {health_url}")

    try:
        response = requests.get(health_url, timeout=5)
        if response.status_code == 200:
            print(f"Status: ✓ Healthy")
            print(f"Response: {response.json()}")
        else:
            print(f"Status: ✗ Unhealthy (HTTP {response.status_code})")
        print("=" * 70)
        return response.status_code == 200

    except requests.exceptions.RequestException as e:
        print(f"Status: ✗ Cannot connect")
        print(f"Error: {e}")
        print("=" * 70)
        return False


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Test LLM serving engine with OpenAI-compatible API",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    parser.add_argument(
        "--base-url",
        default="http://localhost:8000/v1",
        help="Base URL of the LLM server"
    )

    parser.add_argument(
        "--model",
        default="meta-llama/Meta-Llama-3-8B-Instruct",
        help="Model name to use"
    )

    parser.add_argument(
        "--api-key",
        default="not-needed",
        help="API key (not needed for vLLM by default)"
    )

    parser.add_argument(
        "--message",
        default="What is artificial intelligence? Explain in simple terms.",
        help="Message to send for testing"
    )

    parser.add_argument(
        "--skip-health",
        action="store_true",
        help="Skip health check"
    )

    parser.add_argument(
        "--skip-chat",
        action="store_true",
        help="Skip chat completion test"
    )

    parser.add_argument(
        "--skip-streaming",
        action="store_true",
        help="Skip streaming test"
    )

    parser.add_argument(
        "--skip-completion",
        action="store_true",
        help="Skip text completion test"
    )

    parser.add_argument(
        "--skip-models",
        action="store_true",
        help="Skip models list test"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    print("=" * 70)
    print("LLM Serving Engine - OpenAI Compatible API Test")
    print("=" * 70)
    print(f"Base URL: {args.base_url}")
    print(f"Model: {args.model}")
    print("=" * 70)

    # Initialize client
    client = OpenAI(
        base_url=args.base_url,
        api_key=args.api_key
    )

    results = {
        "health": None,
        "chat": None,
        "streaming": None,
        "completion": None,
        "models": None
    }

    # Run tests
    if not args.skip_health:
        results["health"] = check_server_health(args.base_url)
        if not results["health"]:
            print("\n⚠ Server health check failed. Is the server running?")
            print(f"⚠ Start server with: python -m vllm.entrypoints.openai.api_server --model {args.model}")
            sys.exit(1)

    if not args.skip_models:
        results["models"] = test_models_list(client)

    if not args.skip_chat:
        results["chat"] = test_chat_completion(client, args.model, args.message)

    if not args.skip_streaming:
        results["streaming"] = test_streaming(
            client,
            args.model,
            "Tell me a short story about AI in 3 sentences."
        )

    if not args.skip_completion:
        results["completion"] = test_completion(
            client,
            args.model,
            "Once upon a time in a world of artificial intelligence"
        )

    # Summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)

    for test_name, result in results.items():
        if result is None:
            status = "⊘ Skipped"
        elif result:
            status = "✓ Passed"
        else:
            status = "✗ Failed"
        print(f"{test_name.capitalize():15} {status}")

    print("=" * 70)

    # Exit with appropriate code
    failed_tests = [name for name, result in results.items() if result is False]
    if failed_tests:
        print(f"\n⚠ {len(failed_tests)} test(s) failed")
        sys.exit(1)
    else:
        print("\n✓ All tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
