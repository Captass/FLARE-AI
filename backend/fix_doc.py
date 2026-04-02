import re

file_path = r'backend/agents/workers/document_worker.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix update_word_document
old_update = """        @tool
        async def update_word_document(file_path_or_url: str, elements_json: str, config: RunnableConfig) -> str:
        \"\"\"Met à jour un document Word (.docx) existant.

        Args:
        file_path_or_url: L'URL ou le chemin du document à modifier.
        elements_json: La nouvelle structure JSON du document (obtenue après modification du JSON retourné par read_word_document_as_json).
        \"\"\"
        import os
        filename = \"Document_mis_a_jour.docx\"
        if \"/\" in file_path_or_url:
        filename = file_path_or_url.split(\"/\")[-1].split(\"?\")[0]
        if filename.startswith(\"doc_\"):
            parts = filename.split(\"_\", 2)
            if len(parts) >= 3:
                filename = parts[-1]

        result = await generate_word_document.invoke({\"filename\": filename, \"elements_json\": elements_json}, config=config)

        if file_path_or_url.startswith(\"http\"):
        try:
            from core.firebase_client import firebase_storage
            bucket_url_prefix = f\"https://storage.googleapis.com/{settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/\"
            if file_path_or_url.startswith(bucket_url_prefix):
                path_to_delete = file_path_or_url.replace(bucket_url_prefix, \"\")
                firebase_storage.delete_file(path_to_delete)
        except Exception as e:
            logger.error(f\"Failed to delete old cloud file: {e}\")
            pass

        return f\"Mise à jour réussie. {result}\""""

new_update = """@tool
async def update_word_document(file_path_or_url: str, elements_json: str, config: RunnableConfig) -> str:
    \"\"\"Met à jour un document Word (.docx) existant.

    Args:
        file_path_or_url: L'URL ou le chemin du document à modifier.
        elements_json: La nouvelle structure JSON du document (obtenue après modification du JSON retourné par read_word_document_as_json).
    \"\"\"
    import os
    filename = \"Document_mis_a_jour.docx\"
    if \"/\" in file_path_or_url:
        filename = file_path_or_url.split(\"/\")[-1].split(\"?\")[0]
        if filename.startswith(\"doc_\"):
            parts = filename.split(\"_\", 2)
            if len(parts) >= 3:
                filename = parts[-1]

    result = await generate_word_document.invoke({\"filename\": filename, \"elements_json\": elements_json}, config=config)

    if file_path_or_url.startswith(\"http\"):
        try:
            from core.firebase_client import firebase_storage
            bucket_url_prefix = f\"https://storage.googleapis.com/{settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/\"
            if file_path_or_url.startswith(bucket_url_prefix):
                path_to_delete = file_path_or_url.replace(bucket_url_prefix, \"\")
                firebase_storage.delete_file(path_to_delete)
        except Exception as e:
            logger.error(f\"Failed to delete old cloud file: {e}\")
            pass

    return f\"Mise à jour réussie. {result}\""""

content = content.replace(old_update, new_update)

old_delete = """        @tool
        async def delete_word_document(file_path_or_url: str) -> str:
        \"\"\"Supprime un document Word (.docx) existant.

        Args:
        file_path_or_url: L'URL ou le chemin local du document à supprimer.
        \"\"\"
        import os
        if file_path_or_url.startswith(\"http\"):
        try:
            from core.firebase_client import firebase_storage
            bucket_url_prefix = f\"https://storage.googleapis.com/{settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/\"
            if file_path_or_url.startswith(bucket_url_prefix):
                path_to_delete = file_path_or_url.replace(bucket_url_prefix, \"\")
                success = firebase_storage.delete_file(path_to_delete)
                if success:
                    return f\"Le document a été supprimé avec succès du stockage cloud.\"
                else:
                    return \"Échec de la suppression du document cloud.\"
            else:
                return \"L'URL fournie ne correspond pas au stockage de l'application. Suppression ignorée.\"
        except Exception as e:
            return f\"Erreur lors de la suppression du document cloud: {e}\"
        else:
        try:
            if os.path.exists(file_path_or_url):
                os.remove(file_path_or_url)
                return f\"Le fichier local '{file_path_or_url}' a été supprimé avec succès.\"
            else:
                return f\"Le fichier local '{file_path_or_url}' n'existe pas.\"
        except Exception as e:
            return f\"Erreur lors de la suppression du fichier local: {e}\""""

new_delete = """@tool
async def delete_word_document(file_path_or_url: str) -> str:
    \"\"\"Supprime un document Word (.docx) existant.

    Args:
        file_path_or_url: L'URL ou le chemin local du document à supprimer.
    \"\"\"
    import os
    if file_path_or_url.startswith(\"http\"):
        try:
            from core.firebase_client import firebase_storage
            bucket_url_prefix = f\"https://storage.googleapis.com/{settings.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/\"
            if file_path_or_url.startswith(bucket_url_prefix):
                path_to_delete = file_path_or_url.replace(bucket_url_prefix, \"\")
                success = firebase_storage.delete_file(path_to_delete)
                if success:
                    return f\"Le document a été supprimé avec succès du stockage cloud.\"
                else:
                    return \"Échec de la suppression du document cloud.\"
            else:
                return \"L'URL fournie ne correspond pas au stockage de l'application. Suppression ignorée.\"
        except Exception as e:
            logger.error(f\"Erreur lors de la suppression cloud: {e}\")
            return f\"Erreur lors de la suppression cloud: {e}\"
    else:
        try:
            if os.path.exists(file_path_or_url):
                os.remove(file_path_or_url)
                return f\"Document local {file_path_or_url} supprimé avec succès.\"
            else:
                return f\"Le fichier local {file_path_or_url} n'existe pas.\"
        except Exception as e:
            return f\"Erreur lors de la suppression locale: {e}\""""

content = content.replace(old_delete, new_delete)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Replaced content successfully')