import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Kakao Maps JS SDK - autoload=false로 명시적 초기화 제어
const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY || '';
if (kakaoKey) {
  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  // autoload=false: kakao.maps.load() 콜백에서 정확한 타이밍 제어
  s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`;
  s.onload = () => {
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => {
        window.kakaoSdkReady = true;
        window.dispatchEvent(new Event('kakao-sdk-ready'));
      });
    }
  };
  s.onerror = () => {
    const domain = window.location.hostname;
    console.error(`[Kakao] SDK 로드 실패. 현재 도메인(${domain})이 카카오 개발자 콘솔 → 플랫폼(웹) → JavaScript SDK 도메인에 등록되어 있는지 확인하세요.`);
    window.kakaoSdkError = true;
    window.dispatchEvent(new Event('kakao-sdk-error'));
  };
  document.head.appendChild(s);
} else {
  console.warn('[Kakao] VITE_KAKAO_JS_KEY 환경변수가 .env.local에 설정되지 않았습니다.');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
