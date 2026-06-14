package rest

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/sater-151/todo-list/internal/controller/rest/board"
	"github.com/sater-151/todo-list/internal/controller/rest/column"
	"github.com/sater-151/todo-list/internal/controller/rest/task"
	tasktype "github.com/sater-151/todo-list/internal/controller/rest/type"
	"github.com/sater-151/todo-list/internal/controller/rest/user"
	boardservice "github.com/sater-151/todo-list/internal/service/board"
	columnservice "github.com/sater-151/todo-list/internal/service/column"
	taskservice "github.com/sater-151/todo-list/internal/service/task"
	typeservice "github.com/sater-151/todo-list/internal/service/type"
	userservice "github.com/sater-151/todo-list/internal/service/user"
)

type Services struct {
	BoardService  boardservice.Board
	ColumnService columnservice.Column
	TaskService   taskservice.Task
	TypeService   typeservice.Type
	UserService   userservice.User
}

type Rest struct {
	s Services
}

func New(s Services) *Rest {
	return &Rest{
		s: s,
	}
}

func (r *Rest) Run() *gin.Engine {
	router := gin.Default()
	router.Use(gin.Recovery())

	apiGroup := router.Group("/api")

	user.Router(r.s.UserService, apiGroup)
	board.Router(r.s.BoardService, r.s.UserService, apiGroup)
	column.Router(r.s.ColumnService, r.s.BoardService, r.s.UserService, apiGroup)
	task.Router(r.s.TaskService, r.s.ColumnService, r.s.TypeService, r.s.BoardService, r.s.UserService, apiGroup)
	tasktype.Router(r.s.TypeService, r.s.UserService, apiGroup)

	registerWebRoutes(router)

	return router
}

func registerWebRoutes(router *gin.Engine) {
	router.Static("/css", "./web/css")
	router.Static("/js", "./web/js")
	router.Static("/mobile/css", "./web/mobile/css")
	router.Static("/mobile/js", "./web/mobile/js")
	router.StaticFile("/favicon.ico", "./web/favicon.ico")

	page := func(fileName string) gin.HandlerFunc {
		return func(ctx *gin.Context) {
			serveWebPage(ctx, fileName)
		}
	}

	servePage := func(path, fileName string) {
		handler := page(fileName)
		router.GET(path, handler)
		router.HEAD(path, handler)
	}

	servePage("/", "index.html")
	servePage("/login", "login.html")
	servePage("/register", "register.html")
	servePage("/home", "home.html")
	servePage("/settings", "settings.html")
	servePage("/boards/:board", "board.html")
	servePage("/boards/:board/overview", "overview.html")
	servePage("/boards/:board/tasks/:task", "task.html")

	router.NoRoute(func(ctx *gin.Context) {
		if strings.HasPrefix(ctx.Request.URL.Path, "/api/") {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "не найдено"})
			return
		}

		if ctx.Request.Method != http.MethodGet {
			ctx.Status(http.StatusNotFound)
			return
		}

		serveWebPage(ctx, "index.html")
	})
}

func fileExists(fileName string) bool {
	info, err := os.Stat(fileName)
	return err == nil && !info.IsDir()
}

func serveWebPage(ctx *gin.Context, fileName string) {
	desktopFileName := "./web/" + fileName

	if !isMobileRequest(ctx) {
		ctx.File(desktopFileName)
		return
	}

	page, err := os.ReadFile(desktopFileName)
	if err != nil {
		ctx.Status(http.StatusNotFound)
		return
	}

	html := string(page)
	if fileExists("./web/mobile/css/style.css") {
		html = strings.ReplaceAll(html, `href="/css/style.css"`, `href="/mobile/css/style.css"`)
	}
	if fileExists("./web/mobile/js/app.js") {
		html = strings.ReplaceAll(html, `src="/js/app.js"`, `src="/mobile/js/app.js"`)
	}

	ctx.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func isMobileRequest(ctx *gin.Context) bool {
	userAgent := strings.ToLower(ctx.Request.UserAgent())
	mobileMarkers := []string{
		"android",
		"iphone",
		"ipod",
		"ipad",
		"blackberry",
		"iemobile",
		"opera mini",
		"mobile",
	}

	for _, marker := range mobileMarkers {
		if strings.Contains(userAgent, marker) {
			return true
		}
	}

	return false
}
