package rest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestWebRoutesServeDesktopPages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := New(Services{}).Run()

	for _, path := range webPagePaths() {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("GET %s status = %d, want %d; body: %s", path, rec.Code, http.StatusOK, rec.Body.String())
			}

			body := rec.Body.String()
			if !strings.Contains(body, `href="/css/style.css"`) {
				t.Fatalf("desktop page %s should use desktop css, body: %s", path, body)
			}
			if !strings.Contains(body, `src="/js/app.js"`) {
				t.Fatalf("desktop page %s should use desktop js, body: %s", path, body)
			}
		})
	}
}

func TestWebRoutesServeMobilePagesWithMobileAssets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := New(Services{}).Run()

	for _, path := range webPagePaths() {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("mobile GET %s status = %d, want %d; body: %s", path, rec.Code, http.StatusOK, rec.Body.String())
			}

			body := rec.Body.String()
			if !strings.Contains(body, `href="/mobile/css/style.css"`) {
				t.Fatalf("mobile page %s should use mobile css, body: %s", path, body)
			}
			if !strings.Contains(body, `src="/mobile/js/app.js"`) {
				t.Fatalf("mobile page %s should use mobile js, body: %s", path, body)
			}
		})
	}
}

func webPagePaths() []string {
	return []string{
		"/",
		"/login",
		"/register",
		"/home",
		"/settings",
		"/boards/board-1",
		"/boards/board-1/overview",
		"/boards/board-1/tasks/task-1",
	}
}
