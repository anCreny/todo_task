package validation

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

var (
	passwordHasLower   = regexp.MustCompile(`[a-z]`)
	passwordHasUpper   = regexp.MustCompile(`[A-Z]`)
	passwordHasDigit   = regexp.MustCompile(`[0-9]`)
	passwordHasSpecial = regexp.MustCompile(`[^A-Za-z0-9]`)
)

func ValidateUserCreate(userCreate entity.UserCreate, users entity.Users) error {
	login := userCreate.Login
	if login == "" {
		return errors.New("логин не заполнен")
	}

	for _, u := range users {
		if u.Login == login {
			return fmt.Errorf("пользователь %s уже существует", login)
		}
	}

	if !utils.IsMatchRegexp(login, "^[a-z0-9]+$") {
		return errors.New("логин может содержать только строчные латинские буквы и цифры")
	}

	if len(login) > 10 {
		return errors.New("логин не должен быть длиннее 10 символов")
	}

	return ValidatePassword(userCreate.Password, "пароль")
}

func ValidatePassword(password, fieldName string) error {
	if password == "" {
		return fmt.Errorf("%s не заполнен", fieldName)
	}

	if len(password) < 8 {
		return fmt.Errorf("%s должен быть не короче 8 символов", fieldName)
	}

	if len(password) > 30 {
		return fmt.Errorf("%s не должен быть длиннее 30 символов", fieldName)
	}

	if !passwordHasLower.MatchString(password) {
		return fmt.Errorf("%s должен содержать хотя бы одну строчную латинскую букву", fieldName)
	}

	if !passwordHasUpper.MatchString(password) {
		return fmt.Errorf("%s должен содержать хотя бы одну заглавную латинскую букву", fieldName)
	}

	if !passwordHasDigit.MatchString(password) {
		return fmt.Errorf("%s должен содержать хотя бы одну цифру", fieldName)
	}

	if !passwordHasSpecial.MatchString(password) {
		return fmt.Errorf("%s должен содержать хотя бы один специальный символ", fieldName)
	}

	return nil
}
