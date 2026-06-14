package validation

import (
	"errors"

	"github.com/sater-151/todo-list/internal/entity"
	"github.com/sater-151/todo-list/pkg/utils"
)

func ValidateTypeUpdate(typeUpdate entity.TypeUpdate, types entity.Types) error {
	if typeUpdate.Name != nil {
		name := *typeUpdate.Name

		if name == "" {
			return errors.New("название типа не заполнено")
		}

		if len(name) > 10 {
			return errors.New("название типа не должно быть длиннее 10 символов")
		}

		if !utils.IsMatchRegexp(name, `^[a-z0-9_.-]+$`) {
			return errors.New("название типа может содержать только строчные латинские буквы, цифры, '_', '-' и '.'")
		}

		for _, t := range types {
			if t.Name == name {
				return errors.New("тип с таким названием уже существует")
			}
		}
	}

	if typeUpdate.Color != nil {
		color := *typeUpdate.Color

		if color == "" {
			return errors.New("цвет типа не заполнен")
		}

		if !utils.IsMatchRegexp(color, `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`) {
			return errors.New("цвет типа должен быть в HEX-формате")
		}
	}

	return nil
}
