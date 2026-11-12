# Pastel look and small helpers for the StudyPilot page.
import html

import streamlit as st

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
html, body, .stApp, button, input, textarea { font-family: 'Nunito', sans-serif !important; }
.stApp { background: linear-gradient(135deg, #fdf2f8 0%, #eef2ff 45%, #ecfeff 100%); }
header[data-testid="stHeader"] { background: transparent; }
[data-testid="stSidebar"] { background: linear-gradient(180deg, #f5f3ff, #fce7f3); }

.sp-hero { padding: 1.4rem 1.8rem; border-radius: 28px; margin-bottom: 1rem;
  background: linear-gradient(120deg, #fbcfe8, #ddd6fe, #bae6fd);
  box-shadow: 0 10px 30px rgba(167, 139, 250, .28); animation: float 6s ease-in-out infinite; }
.sp-hero h1 { margin: 0; font-size: 2.2rem; color: #4c3a7a; }
.sp-hero p { margin: .35rem 0 0; color: #5b4b8a; font-weight: 600; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

.stButton > button { border-radius: 999px; border: none; font-weight: 800; padding: .5rem 1.3rem;
  background: linear-gradient(135deg, #c4b5fd, #f9a8d4); color: #3b2f63;
  box-shadow: 0 4px 12px rgba(196, 181, 253, .5); transition: all .2s ease; }
.stButton > button:hover { transform: translateY(-2px) scale(1.04); color: #3b2f63;
  box-shadow: 0 8px 20px rgba(249, 168, 212, .6); }
.stButton > button:active { transform: scale(.96); }

[data-testid="stChatMessage"] { border-radius: 22px; padding: .9rem 1rem; margin-bottom: .6rem;
  background: rgba(255, 255, 255, .8); box-shadow: 0 4px 16px rgba(167, 139, 250, .15);
  animation: pop .35s ease; }
@keyframes pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

button[data-baseweb="tab"] { border-radius: 999px; font-weight: 800; }
[data-testid="stExpander"] { border-radius: 18px; background: rgba(255, 255, 255, .6); }

.sp-card { border-radius: 22px; padding: 1rem 1.3rem; margin: .5rem 0; color: #3b3552; font-weight: 600;
  box-shadow: 0 4px 14px rgba(167, 139, 250, .15); animation: pop .35s ease; }
.sp-card.lav { background: #ede9fe; } .sp-card.pink { background: #fce7f3; }
.sp-card.mint { background: #d1fae5; } .sp-card.peach { background: #ffedd5; }
.sp-card.sky { background: #e0f2fe; }

.sp-flash { min-height: 230px; display: flex; align-items: center; justify-content: center;
  text-align: center; font-size: 1.5rem; font-weight: 800; color: #4c3a7a; border-radius: 30px;
  padding: 2rem; margin: .5rem 0 1rem; box-shadow: 0 10px 28px rgba(167, 139, 250, .3);
  animation: flip .45s ease; }
.sp-flash.front { background: linear-gradient(135deg, #ddd6fe, #fbcfe8); }
.sp-flash.back { background: linear-gradient(135deg, #bae6fd, #a7f3d0); }
@keyframes flip { from { transform: rotateY(90deg); opacity: .2; } to { transform: rotateY(0); opacity: 1; } }
</style>
"""


def hero():
    st.markdown(
        '<div class="sp-hero"><h1>StudyPilot 📚</h1>'
        '<p>Upload your notes. Chat, take quizzes, flip flashcards and tick off your study plan.</p></div>',
        unsafe_allow_html=True,
    )


def card(text, kind='lav'):
    # text comes from the AI or the user, so it is escaped before it goes into HTML
    st.markdown('<div class="sp-card ' + kind + '">' + html.escape(str(text)) + '</div>', unsafe_allow_html=True)


def flashcard(text, side):
    st.markdown('<div class="sp-flash ' + side + '">' + html.escape(str(text)) + '</div>', unsafe_allow_html=True)
