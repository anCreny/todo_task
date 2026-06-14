package validation

import (
	"errors"

	"github.com/sater-151/todo-list/internal/controller/rest/dto"
)

func ValidateUserPasswordChange(pwdChange dto.UserPasswordChange, userCurrentPassword string) error {

	if pwdChange.OldPassword == "" {
		return errors.New("текущий пароль не заполнен")
	}

	if userCurrentPassword != pwdChange.OldPassword {
		return errors.New("текущий пароль указан неверно")
	}

	if pwdChange.NewPassword == "" {
		return errors.New("новый пароль не заполнен")
	}

	if pwdChange.NewPassword == pwdChange.OldPassword {
		return errors.New("новый пароль должен отличаться от текущего")
	}

	return ValidatePassword(pwdChange.NewPassword, "новый пароль")
}
