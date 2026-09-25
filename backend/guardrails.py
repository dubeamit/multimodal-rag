"""
Guardrails module for Multimodal RAG POC.
Provides multi-layered defense against prompt injections, system prompt leakage,
instruction overrides, and context exploitation.
"""

import re
import logging
from typing import Tuple

logger = logging.getLogger("rag_guardrails")

# Canonical phrases from system prompt that should NEVER appear in output
SYSTEM_PROMPT_CANARIES = [
    "You are an intelligent assistant analyzing multiple documents and videos",
    "Answer the user's question based ONLY on the provided context",
    "When you use information from the context, you MUST include the citation ID in brackets",
    "If you cannot answer the question based on the context, say",
    "<untrusted_context>",
    "</untrusted_context>",
]

# High-confidence injection and instruction override patterns
INJECTION_PATTERNS = [
    # Direct instruction overrides
    r"(?i)\bignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|prompts|rules|commands|constraints)",
    r"(?i)\bdisregard\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|prompts|rules|commands|constraints)",
    r"(?i)\bforget\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions|prompts|rules|commands|constraints)",
    r"(?i)\boverride\s+(all\s+|any\s+)?(previous|prior|above|system)\s+(instructions|prompts|rules|commands)",
    r"(?i)\byou\s+are\s+no\s+longer\s+(an?\s+)?assistant",
    r"(?i)\byou\s+are\s+now\s+(in\s+)?(unrestricted|dan|developer|jailbreak|god|superuser|jailbroken)\s+mode",
    r"(?i)\benter\s+(dan|developer|jailbreak|unrestricted)\s+mode",
    
    # System role / message spoofing
    r"(?i)\[\s*(system|admin|security|root|prompt|system\s+message)\s*\]",
    r"(?i)<\s*(system|admin|override|system_message|instruction|developer)\s*>",
    r"(?i)###\s*(instruction|system|human|user|assistant)\s*:",
    
    # Prompt and context leakage probes
    r"(?i)(what\s+is|show\s+me|print|reveal|output|display|dump|repeat|tell\s+me)\s+(your\s+|the\s+)?(system\s+prompt|developer\s+instructions|initial\s+prompt|hidden\s+prompt|internal\s+instructions|secret\s+instructions)",
    r"(?i)(output|print|dump|show|list)\s*:\s*1\.\s*the\s*system\s*prompt",
    r"(?i)(repeat|echo|print)\s+(everything|the\s+text)\s+(above|prior|before|preceding)",
    r"(?i)(dump|reveal|show|output)\s+all\s+(retrieved\s+documents|context\s+chunks|raw\s+context|hidden\s+metadata)",
    r"(?i)security\s+restrictions\s+have\s+been\s+disabled",
    
    # Hypothetical bypasses / meta-jailbreaks
    r"(?i)pretend\s+(you\s+are|you're)\s+not\s+bound\s+by\s+(any\s+)?(rules|documents|context)",
    r"(?i)simulate\s+a\s+conversation\s+where\s+you\s+reveal\s+(your\s+)?(system\s+prompt|instructions)",
]

COMPILED_INJECTION_REGEX = [re.compile(p) for p in INJECTION_PATTERNS]


def sanitize_input(user_query: str) -> str:
    """
    Sanitizes user input by escaping/neutralizing structural boundary tags.
    """
    if not user_query:
        return ""
    # Strip potential delimiter escape tags that try to break out of data containers
    cleaned = re.sub(r"(?i)</?untrusted_context>", "[REDACTED_TAG]", user_query)
    cleaned = re.sub(r"(?i)</?context>", "[REDACTED_TAG]", cleaned)
    cleaned = re.sub(r"(?i)\[/?SYSTEM.*?\]", "[REDACTED_SYSTEM]", cleaned)
    return cleaned.strip()


def validate_input(user_query: str) -> Tuple[bool, str]:
    """
    Pre-flight guardrail: Screens incoming query for prompt injection,
    instruction overrides, or system leakage attempts.
    
    Returns:
        (is_safe, refusal_or_sanitized_reason)
    """
    if not user_query or not user_query.strip():
        return False, "Query cannot be empty."

    # Check against known adversarial injection patterns
    for pattern in COMPILED_INJECTION_REGEX:
        if pattern.search(user_query):
            logger.warning(f"[Guardrail Triggered] Prompt injection pattern matched: {pattern.pattern}")
            return False, "I cannot answer this request because it contains instructions to override system behavior or access internal configuration."

    return True, ""


def validate_output(answer: str) -> str:
    """
    Post-generation guardrail: Checks model output to ensure no system instructions,
    canaries, or unauthorized internal structures were leaked.
    """
    if not answer:
        return "I cannot answer this based on the provided documents."

    # Check for system prompt canary leaks
    for canary in SYSTEM_PROMPT_CANARIES:
        if canary.lower() in answer.lower():
            logger.warning(f"[Guardrail Triggered] System canary leak detected in output: '{canary}'")
            return "I cannot answer this based on the provided documents."

    return answer
