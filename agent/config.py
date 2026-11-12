import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # reads the .env file when running locally


def get_setting(name, default=None):
    # On Streamlit Cloud, settings come from Secrets. Locally, from .env.
    try:
        import streamlit as st
        if name in st.secrets:
            return st.secrets[name]
    except Exception:
        pass
    return os.getenv(name, default)


def create_client():
    provider = str(get_setting('PROVIDER', 'groq')).lower()
    if provider == 'openai':
        key = get_setting('OPENAI_API_KEY')
        model = get_setting('OPENAI_MODEL', 'gpt-4o-mini')
        base_url = None
    else:
        provider = 'groq'
        key = get_setting('GROQ_API_KEY')
        model = get_setting('GROQ_MODEL', 'openai/gpt-oss-120b')
        base_url = 'https://api.groq.com/openai/v1'
    if not key:
        raise ValueError(provider.upper() + ' API key is not configured.')
    return OpenAI(api_key=key, base_url=base_url), model
