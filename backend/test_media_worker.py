
import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

# Assurez-vous que le chemin d'importation est correct
from agents.workers.media import generate_image, ImageGenerationError

# Mock des dépendances globales et des configurations
@pytest.fixture(autouse=True)
def mock_dependencies():
    with patch('claude.backend.core.config.settings') as mock_settings, \
         patch('claude.backend.core.context.current_user_id') as mock_user_id, \
         patch('claude.backend.core.context.current_session_id') as mock_session_id, \
         patch('claude.backend.core.context.current_request_id') as mock_request_id, \
         patch('claude.backend.core.context.generated_images') as mock_gen_images, \
         patch('claude.backend.core.context.GLOBAL_IMAGE_REGISTRY', {}) as mock_global_registry, \
         patch('claude.backend.core.firebase_client.firebase_storage') as mock_storage, \
         patch('claude.backend.core.database.SessionLocal') as mock_db:
        mock_settings.LLM_PROVIDER = 'google'
        mock_settings.GEMINI_API_KEY = 'fake-key'
        mock_user_id.get.return_value = 'test-user'
        mock_session_id.get.return_value = 'test-session'
        mock_request_id.get.return_value = 'test-request'
        mock_gen_images.get.return_value = []
        mock_storage.upload_file.return_value = "http://fake.url/image.jpg"
        
        yield

@pytest.mark.asyncio
async def test_generate_image_fallback_and_failure():
    """
    Vérifie que la fonction `generate_image` tente le fallback après une erreur
    d'authentification et lève une `ImageGenerationError` si tout échoue.
    """
    
    # 1. Configurer le mock du client genai pour simuler les échecs
    mock_client_instance = MagicMock()
    
    # Simuler une erreur de clé invalide pour tous les appels
    mock_client_instance.models.generate_images.side_effect = Exception("400 Invalid API key provided. Please check your API key and try again.")

    with patch('google.genai.Client', return_value=mock_client_instance) as mock_genai_client:
        
        # 2. Appeler la fonction et s'attendre à une exception spécifique
        with pytest.raises(ImageGenerationError) as excinfo:
            await generate_image.coroutine(prompt="un chaton mignon", config={})

        # 3. Vérifier le message de l'exception
        assert "Tous les modèles de génération d'image ont échoué" in str(excinfo.value)
        assert "Invalid API key" in str(excinfo.value)

        # 4. Vérifier que les deux groupes de modèles ont été essayés
        # MODÈLES_TO_TRY (4) + FALLBACK_MODELS (1) = 5 appels
        assert mock_client_instance.models.generate_images.call_count > 1, "Le fallback n'a pas été tenté"

@pytest.mark.asyncio
async def test_generate_image_success_on_primary():
    """
    Vérifie que l'image est générée avec succès avec le premier modèle disponible.
    """
    mock_client_instance = MagicMock()
    
    # Simuler un succès
    mock_image_data = MagicMock()
    mock_image_data.image.image_bytes = b'fake-image-bytes'
    mock_response = MagicMock()
    mock_response.generated_images = [mock_image_data]
    mock_client_instance.models.generate_images.return_value = mock_response

    with patch('google.genai.Client', return_value=mock_client_instance):
        result = await generate_image.coroutine(prompt="un succès", config={})
        
        assert "Image générée avec" in result
        mock_client_instance.models.generate_images.assert_called_once()
