# Frontend

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.21.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

Para ejecutar una sola vez las pruebas de formularios y permisos en Chrome sin interfaz:

```powershell
npm.cmd run test:ci
```

El comando detecta Chrome o Edge instalado en Windows. También admite `CHROME_BIN`
con la ruta del navegador. Las pruebas de componentes usan servicios simulados;
no requieren backend ni alteran datos del taller. No verifican la sincronización
offline ni sustituyen pruebas de extremo a extremo de la aplicación completa.

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
