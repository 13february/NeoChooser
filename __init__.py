import server
from aiohttp import web
import time
import folder_paths
import os
import numpy as np
from PIL import Image
import comfy.model_management

PAUSE_STATE = {}

# --- Server Routes ---
@server.PromptServer.instance.routes.post("/neo_chooser/reply")
async def api_reply(request):
    data = await request.json()
    PAUSE_STATE[str(data["node_id"])] = data
    return web.json_response({"status": "ok"})

@server.PromptServer.instance.routes.get("/neo_chooser/sounds")
async def get_sounds(request):
    sound_dir = os.path.join(os.path.dirname(__file__), "web", "sounds")
    if not os.path.exists(sound_dir):
        os.makedirs(sound_dir)
        return web.json_response([])
    files = [f for f in os.listdir(sound_dir) if f.lower().endswith('.mp3')]
    files.sort()
    return web.json_response(files)

# --- Node: NeoChooser ---
class NeoChooser:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"images": ("IMAGE",)}, "hidden": {"unique_id": "UNIQUE_ID"}}
    RETURN_TYPES = ("IMAGE",)
    CATEGORY = "NeoNodes"
    FUNCTION = "process"
    def process(self, images, unique_id):
        out_urls = []
        temp_dir = folder_paths.get_temp_directory()
        for i, t in enumerate(images):
            img_data = 255. * t.cpu().numpy()
            img = Image.fromarray(np.clip(img_data, 0, 255).astype(np.uint8))
            filename = f"neo_temp_{unique_id}_{int(time.time())}_{i}.png"
            img.save(os.path.join(temp_dir, filename))
            out_urls.append({"filename": filename, "type": "temp", "subfolder": ""})
        server.PromptServer.instance.send_sync("neo_chooser_show", {"node_id": unique_id, "images": out_urls})
        PAUSE_STATE[str(unique_id)] = None
        while PAUSE_STATE[str(unique_id)] is None:
            time.sleep(0.05)
            comfy.model_management.throw_exception_if_processing_interrupted()
        reply = PAUSE_STATE.pop(str(unique_id))
        if reply["action"] == "cancel":
            comfy.model_management.interrupt_current_processing()
            return (images,)
        return (images,)

# --- Node: NeoTimer ---
class NeoTimer:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {}}
    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "NeoNodes"
    OUTPUT_NODE = True
    def execute(self):
        return {}

# --- Registration ---
NODE_CLASS_MAPPINGS = {
    "NeoChooser": NeoChooser,
    "NeoTimer": NeoTimer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NeoChooser": "Neo Image Chooser 👁️",
    "NeoTimer": "Neo Execution Timer ⚡"
}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]