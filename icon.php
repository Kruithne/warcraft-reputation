<?php
	require_once(__DIR__ . '/../../blizzard_api/lib/api.php');

	$api = new API();
	$api->setRegion('eu');
	$path = $api->getIconImagePath($_GET['icon'], 36, true, __DIR__ . '/images/icons/');

	header('Content-type: image/jpeg');
	echo file_get_contents($path);