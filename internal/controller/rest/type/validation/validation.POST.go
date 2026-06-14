package validation

import (
	"errors"

	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

func ValidateTypeCreate(typeCreate entity.TypeCreate, types entity.Types) error {

	if typeCreate.Name == "" {
		return errors.New("название типа не заполнено")
	}

	for _, t := range types {
		if t.Name == typeCreate.Name {
			return errors.New("тип с таким названием уже существует")
		}
	}

	if typeCreate.Color == "" {
		return errors.New("цвет типа не заполнен")
	}

	if len(typeCreate.Name) > 10 {
		return errors.New("название типа не должно быть длиннее 10 символов")
	}

	if !utils.IsMatchRegexp(typeCreate.Name, `^[a-z0-9_.-]+$`) {
		return errors.New("название типа может содержать только строчные латинские буквы, цифры, '_', '-' и '.'")
	}

	if !utils.IsMatchRegexp(typeCreate.Color, `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`) {
		return errors.New("цвет типа должен быть в HEX-формате")
	}

	return nil
}
