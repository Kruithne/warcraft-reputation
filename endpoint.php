<?php
	error_reporting(0);

	require_once(__DIR__ . '/../../blizzard_api/lib/api.php');
	require_once(__DIR__ . '/../../blizzard_api/response.php');

	$response = new Response();

	if ($_SERVER['CONTENT_TYPE'] === 'application/json') {
		$raw = file_get_contents('php://input');

		if ($raw !== false) {
			$decoded = json_decode($raw);

			if ($decoded !== null) {
				switch ($decoded->action) {
					case 'regions':
						$response->regions = (new API())->getCompleteRegionData();
						break;

					case 'character':
						$api = new API();

						$region = validate_input_string($decoded->region);
						if (!$api->isValidRegion($region)) {
							$response->setError('ERR_REGION', 'Invalid realm region.');
							break;
						}

						$api->setRegion($region);

						$characterName = validate_input_string($decoded->character);
						if (!$api->isValidCharacterName($characterName)) {
							$response->setError('ERR_CHAR_NAME', 'Invalid character name.');
							break;
						}

						$realm = validate_input_string($decoded->realm);
						if (!$api->isValidRealm($realm)) {
							$response->setError('ERR_REALM', 'Invalid realm.');
							break;
						}

						$response->character = $api->getCharacter($characterName, $realm);

						break;

					default:
						$response->setError('ERR_INV_ACTION', 'Invalid request action.');
						break;
				}
			} else {
				$response->setError('ERR_INV_PAYLOAD', 'Invalid JSON payload.');
			}
		} else {
			$response->setError('ERR_INV_REQ', 'Invalid request.');
		}
	} else {
		$response->setError('ERR_CONTENT_TYPE', 'Invalid payload content type.');
	}

	header('Content-type: application/json');
	echo $response->__toString();