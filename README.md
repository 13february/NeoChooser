# ComfyUI Neo Image Chooser 👁️

**Neo Image Chooser** — это узел для выбора изображений в ComfyUI, выполненный в приятном UI. Он позволяет останавливать рабочий процесс для выбора лучших кадров.

<img width="898" height="522" alt="image" src="https://github.com/user-attachments/assets/e6588444-6bea-4ef2-85cb-d93230c9f245" />


## 🚀 Основные возможности

- **🎵Audio Notifications**: Нода позовет вас звуковым сигналом, когда генерация дойдет до этапа выбора. Больше не нужно гипнотизировать монитор в ожидании.
- **Smart Resizing**: 
  - **Compact Mode**: Сжимается в тонкую аккуратную панель, чтобы не занимать место.
  - **Preview Mode**: Расширяется для удобного просмотра и выбора нескольких изображений сразу.
- **⚡ Quick Run**: После того как выбор сделан, кнопки управления заменяются на кнопку **RUN GENERATION**, позволяющую запустить новый цикл прямо из ноды, не возвращаясь к основному меню.
- **Batch Control**: Кнопка **SKIP** для пропуска текущей пачки или **CANCEL** для полной остановки очереди.
- **Neo Timer ⚡**: Нода для отсчета времени генерации в минутах. Синхронизация с NeoChooser - автоматическая пауза таймера при срабатывании Neo Chooser.

## 🛠 Установка

### Через ComfyUI-Manager 
1. Откройте **ComfyUI Manager**.
2. Нажмите кнопку **"Install via Git URL"**.
3. Вставьте ссылку на этот репозиторий: `https://github.com/13february/ComfyUI-NeoChooser`
4. Нажмите **OK** и перезагрузите ComfyUI.


## 🎧 Настройка звуков
Чтобы добавить любые звуки уведомлений, перейдите в папку: custom_nodes/ComfyUI-NeoChooser/web/sounds/
Положите туда свои файлы в формате .mp3. Обновите страницу в браузере.

Бесплатные звуки можно скачать здесь:

[Mixkit Notification Sounds](https://mixkit.co/free-sound-effects/notification/) (Очень чистые и современные звуки).

[Freesound.org](https://freesound.org/) (Огромная база, ищите по тегу "ping" или "notification").

## 📖 Как пользоваться
1. Добавьте ноду через меню: NeoNodes -> NeoChooser.

2. Подключите выход IMAGE от вашего KSampler или VAE Decode к входу ноды.

3. Запустите генерацию. 

4. Когда процесс дойдет до NeoChooser, Генерация встанет на паузу.

5. Кликните на изображения, которые хотите оставить. (Если изображение одно, оно выделится автоматом)

6. Нажмите CONTINUE, чтобы отправить выбранные фото дальше по workflow, или SKIP, если хотите просто продолжить без выбора.

<img width="549" height="629" alt="image" src="https://github.com/user-attachments/assets/6ce2cb87-0e9b-4494-94d9-6055ecb26aba" /> <img width="569" height="238" alt="image" src="https://github.com/user-attachments/assets/7a0ec6c5-4ea2-4cd8-a5e0-9926e4d7d221" />

<img width="432" height="273" alt="image" src="https://github.com/user-attachments/assets/dd160b42-14ef-492c-9c62-5f14cb76776f" />
